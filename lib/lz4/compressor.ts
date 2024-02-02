import { XXH32, xxHash32 } from "../xxhash.js";
import { Buffer, Conduit, conduit, sinkBuffer, takeE, yieldC } from "../stream.js";
import { LZ4MaximumBlockSize, LZ4CompressionOptions } from "./options.js";
import { writeFrameDescriptor } from "./frame.js";

export function compress(input: Uint8Array, opts?: LZ4CompressionOptions): Uint8Array {
    return yieldC(new Buffer(input))
        .fuse(compressC(opts))
        .fuse(sinkBuffer)
        .run()
        .toUint8Array();
}

export function compressC(opts?: LZ4CompressionOptions): Conduit<Buffer, Buffer, void> {
    return new LZ4Compressor(opts);
}

function writeUint32LE(n: number): Conduit<unknown, Buffer, void> {
    return conduit(function* () {
        const buf = new Buffer();
        buf.appendUint32(n, true);
        yield* yieldC(buf);
    });
}

class LZ4Compressor extends Conduit<Buffer, Buffer, void> {
    readonly #opts: Required<LZ4CompressionOptions>;
    readonly #hashSize: number;
    readonly #dictHashTable: Uint16Array;
    readonly #dictionary: Buffer;

    public constructor(opts?: LZ4CompressionOptions) {
        super();
        this.#opts   = {
            independentBlocks: opts?.independentBlocks ?? false,
            blockChecksums:    opts?.blockChecksums    ?? false,
            contentSize:       opts?.contentSize,
            contentChecksum:   opts?.contentChecksum   ?? true,
            dictionary:        opts?.dictionary,
            maximumBlockSize:  opts?.maximumBlockSize  ?? LZ4MaximumBlockSize.MAX_4_MIB,
            hashBits:          opts?.hashBits          ?? 16,
            skipTrigger:       opts?.skipTrigger       ?? 6
        };
        if (this.#opts.maximumBlockSize <= 0)
            throw new RangeError(`maximumBlockSize must be a positive integer: ${this.#opts.maximumBlockSize}`);
        if (this.#opts.hashBits < 0 || this.#opts.hashBits > 32)
            throw new RangeError(`hashBits must be in [0, 32]: ${this.#opts.hashBits}`);
        this.#hashSize      = 2 ** this.#opts.hashBits - 1 >>> 0;
        this.#dictHashTable = new Uint16Array(this.#hashSize);
        this.#dictionary    = new Buffer();
        this.#dictionary.reserve(0xFFFF);

        if (this.#opts.dictionary) {
            // Use the last 64 KiB of the dictionary.
            this.#populateDict(new Buffer(this.#opts.dictionary.data));
        }
    }

    #populateDict(input: Buffer): void {
        if (input.length >= 0xFFFF) {
            // The input is going to completely wash our dictionary
            // away. Take the last 64 KiB of the input.
            this.#dictionary.append(input.unsafeSubBuffer(-0xFFFF));

            // And every offset in the dictionary hash table is now
            // invalid. Need to rebuild it entirely.
            this.#hashDictionary();
        }
        else if (this.#dictionary.length + input.length > 0xFFFF) {
            // Some part of our existing dictionary is going away.
            this.#dictionary.append(input.unsafeSubBuffer(-0xFFFF));
            this.#dictionary.drop(this.#dictionary.length - 0xFFFF);

            // This means every offset in it is now invalid.
            this.#hashDictionary();
        }
        else {
            // Our dictionary is only growing. Offsets aren't going to be
            // invalidated.
            const oldDictSize = this.#dictionary.length;
            this.#dictionary.append(input);

            // But since the last 3 octets of the dictionary hasn't been
            // hashed, we now need to do it.
            this.#hashDictionary(Math.max(0, oldDictSize - 3));
        }
    }

    #hashDictionary(startPos = 0): void {
        this.#dictHashTable.fill(0, startPos);

        for (let offset = startPos; offset + 4 <= this.#dictionary.length; offset++) {
            const word = this.#dictionary.getUint32(offset, true);
            const hash = this.#hashWord(word);

            // The value 0 means "no match". Adding one is safe, because we
            // are never going to record a word at offset 0xFFFF.
            this.#dictHashTable[hash] = offset + 1;
        }
    }

    #hashWord(word: number): number {
        // We don't do an optimal parsing for a performance reason. When
        // hashes collide we miss an opportunity for compressing a sequence
        // of data that starts with a colliding 4-octets word. So we need
        // to use a hash function that is very unlikely to collide. On the
        // other hand we can't use the entirety of the hash values anyway,
        // so full avalanche is an overkill. The function we use here has a
        // good quality in low bits:
        // http://burtleburtle.net/bob/hash/integer.html
        let h = word | 0;
        h += ~(h  << 15) | 0;
        h ^=  (h >>> 10);
        h +=  (h  <<  3) | 0;
        h ^=  (h >>>  6);
        h += ~(h  << 11) | 0;
        h ^=  (h >>> 16);
        return (h & this.#hashSize) >>> 0;
    }

    public *[Symbol.iterator]() {
        yield* writeUint32LE(0x184D2204); // magic
        yield* writeFrameDescriptor({
            independentBlocks: this.#opts.independentBlocks,
            blockChecksums:    this.#opts.blockChecksums,
            contentSize:       this.#opts.contentSize,
            contentChecksum:   this.#opts.contentChecksum,
            dictionaryID:      this.#opts.dictionary?.id,
            maximumBlockSize:  this.#opts.maximumBlockSize
        });
        yield* this.#compressFrame();
    }

    *#compressFrame() {
        const contentHash = this.#opts.contentChecksum ? new XXH32() : undefined;
        let   contentSize = 0;
        while (true) {
            // Take the next block from the input and try compressing
            // it. If it doesn't compress, then write it as an uncompressed
            // block. Unfortunately this cannot be implemented as a
            // one-pass operation and we have to keep the entire block in
            // memory.
            const ret = yield* this.#compressBlock();
            if (!ret)
                break;
            const {rawBlock, compBlock} = ret;

            if (compBlock.length >= rawBlock.length) {
                // Damn, it made no sense to compress it. Write an
                // uncompressed block and discard the other one.
                yield* writeUint32LE(rawBlock.length | 0x80);
                yield* yieldC(rawBlock);
                if (this.#opts.blockChecksums) {
                    yield* writeUint32LE(xxHash32(rawBlock));
                }
            }
            else {
                // It actually compressed.
                yield* writeUint32LE(compBlock.length);
                yield* yieldC(compBlock);
                if (this.#opts.blockChecksums) {
                    yield* writeUint32LE(xxHash32(compBlock));
                }
            }

            contentHash?.update(rawBlock);
            contentSize += rawBlock.length;

            if (!this.#opts.independentBlocks) {
                // Save a copy of the last 64 KiB of the input so that
                // subsequent blocks can find matches in it.
                this.#populateDict(rawBlock);
            }
        }

        // EndMark
        yield* writeUint32LE(0);

        if (this.#opts.contentSize !== undefined) {
            if (this.#opts.contentSize != contentSize) {
                throw new Error(`Content size mismatches: expected ${this.#opts.contentSize}, got ${contentSize}`);
            }
        }

        if (contentHash) {
            yield* writeUint32LE(contentHash.final());
        }
    }

    *#compressBlock() {
        // Read an entire block from the stream. This is unavoidable,
        // because we must retain it in memory anyway in order to decide if
        // we should write a compressed block or not.
        const rawBlock = yield* takeE(this.#opts.maximumBlockSize).fuse(sinkBuffer);
        if (rawBlock.length <= 0)
            // Empty block means we have reached EOF.
            return undefined;

        const compBlock      = new Buffer();
        const blockHashTable = new Uint32Array(this.#hashSize);
        let numNonMatching = 1 << this.#opts.skipTrigger;
        let literalStart   = 0;

        // Matches cannot be any shorter than 4 octets, and the last 5
        // octets must always be a literal.
        for (let blockPos = 0; blockPos + 9 <= rawBlock.length; ) {
            const word = rawBlock.getUint32(blockPos, true);
            const hash = this.#hashWord(word);

            // Try finding a match in the dictionary first. This has a
            // chance of finding a longer one. But we don't attempt to find
            // a match in the last 3 octets in the dictionary because
            // that's a too much effort for a negligible effect.
            const dictPosPlus1 = this.#dictHashTable[hash]!;
            if (dictPosPlus1 > 0 && this.#dictionary.getUint32(dictPosPlus1 - 1, true) == word) {
                // Found a matching 4-octets in the dictionary but can we
                // really use it?
                const distance = (this.#dictionary.length - (dictPosPlus1 - 1)) + blockPos;
                if (distance <= 0xFFFF) {
                    // Yes we can. It's not that far away. Now count the
                    // length of the match in the dictionary.
                    const dictMatchLenMinus4 =
                        this.#findMatchLength(
                            this.#dictionary, dictPosPlus1 - 1 + 4,
                            rawBlock, blockPos + 4);

                    // Can we possibly continue matching on the block too?
                    const blockMatchLen =
                        // Did the match reach the end of the dictionary?
                        dictPosPlus1 - 1 + dictMatchLenMinus4 + 4 >= this.#dictionary.length
                        ? this.#findMatchLength(
                            rawBlock, 0,
                            rawBlock, blockPos + 4 + dictMatchLenMinus4)
                        : 0;

                    // Write a sequence and skip the matched part.
                    const matchLenMinus4 = dictMatchLenMinus4 + blockMatchLen;
                    this.#writeSequence(
                        compBlock, rawBlock.unsafeSubBuffer(literalStart, blockPos),
                        distance, matchLenMinus4);

                    blockPos    += matchLenMinus4 + 4;
                    literalStart = blockPos;
                    continue;
                }

                // Reset the skip counter regardless of whether we could
                // actually use the match.
                numNonMatching = 1 << this.#opts.skipTrigger;
            }

            // No matches in the dictionary. How about in the preceding
            // part of the block?
            const blockPosPlus1 = blockHashTable[hash]!;

            // Don't forget that the last match must start at least 12
            // octets before the end of block.
            if (blockPos + 12 <= rawBlock.length) {
                blockHashTable[hash] = blockPos + 1;
            }

            if (blockPosPlus1 > 0 && rawBlock.getUint32(blockPosPlus1 - 1, true) == word) {
                const distance = blockPos - (blockPosPlus1 - 1);
                if (distance <= 0xFFFF) {
                    // Found a match which we can use. Note that we don't
                    // have to worry about inter-block matching in the
                    // independent blocks case, because the hash table
                    // shouldn't contain any data about past blocks then.
                    const matchLenMinus4 =
                        this.#findMatchLength(
                            rawBlock, blockPosPlus1 - 1 + 4,
                            rawBlock, blockPos + 4);

                    // Write a sequence and skip the matched part.
                    this.#writeSequence(
                        compBlock, rawBlock.unsafeSubBuffer(literalStart, blockPos),
                        distance, matchLenMinus4);

                    blockPos    += matchLenMinus4 + 4;
                    literalStart = blockPos;
                    continue;
                }

                // Reset the skip counter.
                numNonMatching = 1 << this.#opts.skipTrigger;
            }

            // No matches found. Skip this position.
            const step = numNonMatching++ >> this.#opts.skipTrigger;
            blockPos += step;
        }

        this.#writeLiteral(compBlock, rawBlock.unsafeSubBuffer(literalStart));
        return {rawBlock, compBlock};
    }

    #findMatchLength(dict: Buffer, dictPos: number, block: Buffer, blockPos: number): number {
        const matchStart = blockPos;

        // Compare 4 octets at once until we reach the last 3. A match must
        // not cover the last 5 octets of a block.
        for (; dictPos + 4 <= dict.length && blockPos + 9 <= block.length; dictPos += 4, blockPos += 4) {
            if (dict.getUint32(dictPos, true) != block.getUint32(blockPos, true)) {
                break;
            }
        }

        // Compare remaining octets.
        for (; dictPos < dict.length && blockPos + 5 < block.length; dictPos++, blockPos++) {
            if (dict.getUint8(dictPos) != block.getUint8(blockPos)) {
                break;
            }
        }

        return blockPos - matchStart;
    }

    #writeSequence(compBlock: Buffer, literal: Buffer, distance: number, matchLenMinus4: number): void {
        // Write a token and the literal.
        const tokenPos = compBlock.length;
        this.#writeLiteral(compBlock, literal);

        // Fix up the token so it contains the match length.
        const token = compBlock.getUint8(tokenPos) | Math.min(matchLenMinus4, 0xF);
        compBlock.setUint8(tokenPos, token);

        // Write the offset.
        compBlock.appendUint16(distance, true);

        // Write the remaining match length if it doesn't fit in the token.
        if (matchLenMinus4 >= 0xF) {
            matchLenMinus4 -= 0xF;
            for (; matchLenMinus4 >= 0xFF; matchLenMinus4 -= 0xFF) {
                compBlock.appendUint8(0xFF);
            }
            compBlock.appendUint8(matchLenMinus4);
        }
    }

    #writeLiteral(compBlock: Buffer, literal: Buffer): void {
        let literalLen = literal.length;

        // Write a token.
        compBlock.appendUint8(Math.min(literalLen, 0xF) << 4);

        // Write the remaining literal count if it doesn't fit in the token.
        if (literalLen >= 0xF) {
            literalLen -= 0xF;
            for (; literalLen >= 0xFF; literalLen -= 0xFF) {
                compBlock.appendUint8(0xFF);
            }
            compBlock.appendUint8(literalLen);
        }

        // Write the literal.
        compBlock.append(literal);
    }
}
