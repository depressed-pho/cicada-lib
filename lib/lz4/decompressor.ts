import { XXH32 } from "../xxhash.js";
import { OutputStream, InputStream, Buffer, PrematureEOF,
         BufferOutputStream, BufferInputStream } from "../stream.js";
import { readFrameDescriptor } from "./frame.js";
import { LZ4DecompressionOptions } from "./options.js";

export function decompress(input: Uint8Array, opts?: LZ4DecompressionOptions): Uint8Array;

export function decompress<OutputT, InputT>(
    output: OutputStream<OutputT, InputT>,
    input: InputStream<OutputT, InputT>,
    opts?: LZ4DecompressionOptions): Generator<OutputT, void, InputT>;

export function decompress(...args: any[]) {
    switch (args.length) {
        case 1:
            return decompressOneShot(args[0]);
        case 2:
            if (args[0] instanceof Uint8Array) {
                return decompressOneShot(args[0], args[1]);
            }
            else {
                return decompressStream(args[0], args[1]);
            }
        case 3:
            return decompressStream(args[0], args[1], args[2]);
        default:
            throw new TypeError("Wrong number of arguments");
    }
}

function decompressOneShot(input: Uint8Array, opts?: LZ4DecompressionOptions): Uint8Array {
    const os  = new BufferOutputStream();
    const is  = new BufferInputStream(new Buffer(input));
    const gen = new LZ4Decompressor(os, is, opts).run();

    if (!gen.next().done) {
        throw new Error("Internal error: the generator yielded when it shouldn't");
    }

    return os.data.toUint8Array();
}

function decompressStream<OutputT, InputT>(
    output: OutputStream<OutputT, InputT>,
    input: InputStream<OutputT, InputT>,
    opts?: LZ4DecompressionOptions): Generator<OutputT, void, InputT> {

    output.onYield((data) => input.gotData(data));
    input.onYield(() => output.takeData());

    return new LZ4Decompressor(output, input, opts).run();
}

class LZ4Decompressor<OutputT, InputT> {
    readonly #output: OutputStream<OutputT, InputT>;
    readonly #input: InputStream<OutputT, InputT>;
    readonly #opts: Required<LZ4DecompressionOptions>;
    readonly #dictionary: Buffer;

    public constructor(output: OutputStream<OutputT, InputT>,
                       input: InputStream<OutputT, InputT>,
                       opts?: LZ4DecompressionOptions) {
        this.#output = output;
        this.#input  = input;
        this.#opts   = {
            resolveDictionary: opts?.resolveDictionary ?? (() => undefined)
        };
        this.#dictionary = new Buffer();
        this.#dictionary.reserve(0xFFFF);
    }

    public *run(): Generator<OutputT, void, InputT> {
        while ((yield* this.#input.isEOF()) == false) {
            const magic = yield* this.#input.readUint32(true);

            if (magic == 0x184D2204) {
                // This is an LZ4 frame.
                yield* this.decompressFrame();
            }
            else if (magic >= 0x184D2A50 && magic <= 0x184D2A5F) {
                // This is a skippable frame.
                const frameSize = yield* this.#input.readUint32(true);
                this.#input.skip(frameSize);
            }
            else {
                throw new RangeError(`Unknown magic number: ${magic}`);
            }
        }
    }

    public *decompressFrame(): Generator<OutputT, void, InputT> {
        const desc = yield* readFrameDescriptor(this.#input);

        const initialDict = new Buffer();
        if (desc.dictionaryID !== undefined) {
            // Use the last 64 KiB of the dictionary.
            const dict = this.#opts.resolveDictionary(desc.dictionaryID);
            if (dict) {
                initialDict.unsafeAppend(dict.subarray(-0xFFFF));
            }
            else {
                throw new Error(`Dictionary ${desc.dictionaryID.toString(16)} is not available`);
            }
        }

        this.#dictionary.clear();
        this.#dictionary.unsafeAppend(initialDict);

        const contentHash = desc.contentChecksum ? new XXH32() : undefined;
        let   contentSize = 0;
        while (true) {
            const blockSize = yield* this.#input.readUint32(true);

            if (blockSize == 0) {
                // The end of blocks.
                break;
            }

            const isCompressed  = (blockSize & 0x80) == 0;
            const realBlockSize = isCompressed ? blockSize : blockSize ^ 0x80;
            if (realBlockSize > desc.maximumBlockSize) {
                throw new Error(`The block exceeds the maximum size: ${realBlockSize} > ${desc.maximumBlockSize}`);
            }
            const blockHash     = desc.blockChecksums ? new XXH32() : undefined;

            if (isCompressed) {
                contentSize += yield* this.#decompressBlock(realBlockSize, blockHash, contentHash);

                if (desc.independentBlocks) {
                    // The next block will refer to the predefined
                    // dictionary again.
                    this.#dictionary.clear();
                    this.#dictionary.unsafeAppend(initialDict);
                }
            }
            else {
                for (let remaining = realBlockSize; remaining > 0; ) {
                    const chunk = yield* this.#input.readSome(remaining);
                    if (!chunk) {
                        throw new PrematureEOF(`Got an EOF before reading ${realBlockSize} octets of uncompressed block`);
                    }

                    yield* this.#output.unsafeWrite(chunk);
                    contentSize += chunk.length;
                    remaining   -= chunk.length;

                    blockHash?.update(chunk);
                    contentHash?.update(chunk);
                }
            }

            if (blockHash) {
                const expectedSum = yield* this.#input.readUint32(true);
                const actualSum   = blockHash.final();

                if (expectedSum != actualSum) {
                    throw new Error(`Block checksum mismatches: expected ${expectedSum.toString(16)}, got ${actualSum.toString(16)}`);
                }
            }
        }

        if (desc.contentSize !== undefined) {
            if (desc.contentSize != contentSize) {
                throw new Error(`Content size mismatches: expected ${desc.contentSize}, got ${contentSize}`);
            }
        }

        if (contentHash) {
            const expectedSum = yield* this.#input.readUint32(true);
            const actualSum   = contentHash.final();

            if (expectedSum != actualSum) {
                //throw new Error(`Content checksum mismatches: expected ${expectedSum.toString(16)}, got ${actualSum.toString(16)}`);
            }
        }
    }

    *#decompressBlock(blockSize: number, blockHash?: XXH32, contentHash?: XXH32): Generator<OutputT, number, InputT> {
        const blockBuf = blockHash ? new Buffer() : undefined;

        let contentSize = 0;
        while (true) {
            if (blockSize < 0) {
                throw new RangeError(`Corrupted block: length doesn't match`);
            }

            const token = yield* this.#input.readUint8();
            blockSize--;
            blockBuf?.appendUint8(token);

            let literalLen = (token & 0xF0) >>> 4;
            if (literalLen >= 0xF) {
                // Read the remaining literal count because it didn't fit
                // in the token.
                while (true) {
                    const n = yield* this.#input.readUint8();
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
            const literal = yield* this.#input.read(literalLen);
            blockSize   -= literalLen;
            contentSize += literalLen;

            yield* this.#output.unsafeWrite(literal);
            this.#populateDict(literal);
            blockHash?.update(literal);
            contentHash?.update(literal);

            if (blockSize == 0) {
                // This is the last block. No offset shall exist.
                break;
            }

            // Read the offset.
            const offset = yield* this.#input.readUint16(true);
            if (offset == 0) {
                throw new RangeError(`Corrupted block: offset 0 is invalid`);
            }
            else if (offset > this.#dictionary.length) {
                throw new RangeError(`Offset ${offset} is too far away from the sequence`);
            }
            blockSize -= 2;
            blockBuf?.appendUint16(offset, true);

            let matchLen = (token & 0xF) + 4;
            if (matchLen >= 0xF + 4) {
                // Read the remaining match length because it didn't fit in
                // the token.
                while (true) {
                    const n = yield* this.#input.readUint8();
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
                const matched   = this.#dictionary.unsafeSubarray(dictPos, dictEnd);
                matchLen    -= actualLen;
                contentSize += actualLen;

                yield* this.#output.unsafeWrite(matched);
                copied.unsafeAppend(matched);
                contentHash?.update(matched);
            }
            this.#populateDict(copied);
        }

        return contentSize;
    }

    #populateDict(octets: Buffer): void {
        // Keep the last 64 KiB of uncompressed data.
        this.#dictionary.unsafeAppend(octets.unsafeSubarray(-0xFFFF));
        this.#dictionary.drop(this.#dictionary.length - 0xFFFF);
    }
}
