import { XXH32 } from "../xxhash.js";
import { Buffer } from "../buffer.js";
import { Conduit, PrematureEOF, awaitC, conduit, dropE, headE,
         peekForeverE, sinkBuffer, takeE, takeExactlyE, yieldC
       } from "../conduit.js";
import { readFrameDescriptor } from "./frame.js";
import { LZ4DecompressionOptions } from "./options.js";

export function decompress(input: Uint8Array, opts?: LZ4DecompressionOptions): Uint8Array {
    return yieldC(new Buffer(input))
        .fuse(decompressC(opts))
        .fuse(sinkBuffer)
        .run()
        .toUint8Array();
}

export function decompressC(opts?: LZ4DecompressionOptions): Conduit<Buffer, Buffer, void> {
    return new LZ4Decompressor(opts);
}

const readUint8 /* : Conduit<Buffer, never, number> */ =
    conduit(function* () {
        const o = yield* headE;
        if (o !== undefined)
            return o;
        else
            throw new PrematureEOF(
                "Premature end of stream while reading an uint32 value");
    });

const readUint16LE /* : Conduit<Buffer, never, number> */ =
    takeExactlyE(2, conduit(function* () {
        let n = 0;
        for (let i = 0, shift = 0; i < 2; ) {
            const chunk = yield* awaitC;
            if (chunk) {
                for (const o of chunk) {
                    n |= (o & 0xFF) << shift;
                    i++;
                    shift += 8;
                }
            }
            else {
                throw new PrematureEOF(
                    "Premature end of stream while reading an uint16 value");
            }
        }
        return n >>> 0;
    }));

const readUint32LE /* : Conduit<Buffer, never, number> */ =
    takeExactlyE(4, conduit(function* () {
        let n = 0;
        for (let i = 0, shift = 0; i < 4; ) {
            const chunk = yield* awaitC;
            if (chunk) {
                for (const o of chunk) {
                    n |= (o & 0xFF) << shift;
                    i++;
                    shift += 8;
                }
            }
            else {
                throw new PrematureEOF(
                    "Premature end of stream while reading an uint32 value");
            }
        }
        return n >>> 0;
    }));

class LZ4Decompressor extends Conduit<Buffer, Buffer, void> {
    readonly #opts: Required<LZ4DecompressionOptions>;
    readonly #dictionary: Buffer;

    public constructor(opts?: LZ4DecompressionOptions) {
        super();
        this.#opts   = {
            resolveDictionary: opts?.resolveDictionary ?? (() => undefined)
        };
        this.#dictionary = new Buffer();
        this.#dictionary.reserve(0xFFFF);
    }

    public *[Symbol.iterator]() {
        yield* peekForeverE(conduit(() => this.#decompressAnyFrame()));
    }

    *#decompressAnyFrame() {
        const magic = yield* readUint32LE;

        if (magic == 0x184D2204) {
            // This is an LZ4 frame.
            yield* this.#decompressLZ4Frame();
        }
        else if (magic >= 0x184D2A50 && magic <= 0x184D2A5F) {
            // This is a skippable frame.
            const frameSize = yield* readUint32LE;
            yield* dropE(frameSize);
        }
        else {
            throw new Error(`Unknown magic number: ${magic}`);
        }
    }

    *#decompressLZ4Frame() {
        const desc = yield* readFrameDescriptor;

        const initialDict = new Buffer();
        if (desc.dictionaryID !== undefined) {
            // Use the last 64 KiB of the dictionary.
            const dict = this.#opts.resolveDictionary(desc.dictionaryID);
            if (dict)
                initialDict.append(dict.subarray(-0xFFFF));
            else
                throw new Error(`Dictionary ${desc.dictionaryID.toString(16)} is not available`);
        }

        this.#dictionary.clear();
        this.#dictionary.append(initialDict);

        const contentHash = desc.contentChecksum ? new XXH32() : undefined;
        let   contentSize = 0;
        while (true) {
            const blockSize = yield* readUint32LE;

            if (blockSize == 0) {
                // The end of blocks.
                break;
            }

            const isCompressed  = (blockSize & 0x80) == 0;
            const realBlockSize = isCompressed ? blockSize : blockSize ^ 0x80;
            if (realBlockSize > desc.maximumBlockSize)
                throw new Error(`The block exceeds the maximum size: ${realBlockSize} > ${desc.maximumBlockSize}`);
            const blockHash     = desc.blockChecksums ? new XXH32() : undefined;

            if (isCompressed) {
                contentSize += yield* this.#decompressBlock(realBlockSize, blockHash, contentHash);

                if (desc.independentBlocks) {
                    // The next block will refer to the predefined
                    // dictionary again.
                    this.#dictionary.clear();
                    this.#dictionary.append(initialDict);
                }
            }
            else {
                const block = yield* takeE(realBlockSize).fuse(sinkBuffer);
                if (block.length < realBlockSize)
                    throw new PrematureEOF(
                        `Premature end of stream while reading an uncompressed block of ${realBlockSize} octets`);

                yield* yieldC(block);
                contentSize += block.length;

                blockHash?.update(block);
                contentHash?.update(block);
            }

            if (blockHash) {
                const expectedSum = yield* readUint32LE;
                const actualSum   = blockHash.final();

                if (expectedSum != actualSum)
                    throw new Error(
                        `Block checksum mismatches: expected ${expectedSum.toString(16)}, got ${actualSum.toString(16)}`);
            }
        }

        if (desc.contentSize !== undefined) {
            if (desc.contentSize != contentSize)
                throw new Error(
                    `Content size mismatches: expected ${desc.contentSize}, got ${contentSize}`);
        }

        if (contentHash) {
            const expectedSum = yield* readUint32LE;
            const actualSum   = contentHash.final();

            if (expectedSum != actualSum) {
                throw new Error(
                    `Content checksum mismatches: expected ${expectedSum.toString(16)}, got ${actualSum.toString(16)}`);
            }
        }
    }

    *#decompressBlock(blockSize: number, blockHash?: XXH32, contentHash?: XXH32) {
        const blockBuf = blockHash ? new Buffer() : undefined;

        let contentSize = 0;
        while (true) {
            if (blockSize < 0)
                throw new Error("Corrupted block: length doesn't match");

            const token = yield* readUint8;
            blockSize--;
            blockBuf?.appendUint8(token);

            let literalLen = (token & 0xF0) >>> 4;
            if (literalLen >= 0xF) {
                // Read the remaining literal count because it didn't fit
                // in the token.
                while (true) {
                    const n = yield* readUint8;
                    blockSize--;
                    blockBuf?.appendUint8(n);

                    literalLen += n;
                    if (n < 0xFF) {
                        break;
                    }
                }
            }

            if (blockBuf) {
                blockHash!.update(blockBuf);
                blockBuf.clear();
            }

            // Read the literal.
            const literal = yield* takeE(literalLen).fuse(sinkBuffer);
            if (literal.length < literalLen)
                throw new Error("Premature end of stream while reading a literal");
            blockSize   -= literalLen;
            contentSize += literalLen;

            yield* yieldC(literal);
            this.#populateDict(literal);
            blockHash?.update(literal);
            contentHash?.update(literal);

            if (blockSize == 0)
                // This is the last block. No offsets shall exist.
                break;

            // Read the offset.
            const offset = yield* readUint16LE;
            if (offset == 0)
                throw new Error(`Corrupted block: offset 0 is invalid`);
            else if (offset > this.#dictionary.length)
                throw new Error(`Offset ${offset} is too far away from the sequence`);
            blockSize -= 2;
            blockBuf?.appendUint16(offset, true);

            let matchLen = (token & 0xF) + 4;
            if (matchLen >= 0xF + 4) {
                // Read the remaining match length because it didn't fit in
                // the token.
                while (true) {
                    const n = yield* readUint8;
                    blockSize--;
                    blockBuf?.appendUint8(n);

                    matchLen += n;
                    if (n < 0xFF) {
                        break;
                    }
                }
            }

            if (blockBuf) {
                blockHash!.update(blockBuf);
                blockBuf.clear();
            }

            // Copy it from the past. Note that matches may overlap. We may
            // have to repeat data we are copying.
            const copied = new Buffer();
            while (matchLen > 0) {
                const actualLen = Math.min(matchLen, offset);
                const dictPos   = this.#dictionary.length - offset;
                const dictEnd   = dictPos + actualLen;
                const matched   = this.#dictionary.unsafeSubBuffer(dictPos, dictEnd);
                matchLen    -= actualLen;
                contentSize += actualLen;

                yield* yieldC(matched);
                copied.append(matched);
                contentHash?.update(matched);
            }
            this.#populateDict(copied);
        }

        return contentSize;
    }

    #populateDict(octets: Buffer): void {
        // Keep the last 64 KiB of uncompressed data.
        this.#dictionary.append(octets.unsafeSubBuffer(-0xFFFF));
        this.#dictionary.drop(this.#dictionary.length - 0xFFFF);
    }
}
