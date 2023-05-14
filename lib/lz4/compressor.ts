import { XXH32, xxHash32 } from "../xxhash.js";
import { OutputStream, InputStream, Buffer,
         BufferOutputStream, BufferInputStream } from "../stream.js";
import { LZ4MaximumBlockSize, LZ4CompressionOptions } from "./options.js";
import { writeFrameDescriptor } from "./frame.js";

export function compress(input: Uint8Array, opts?: LZ4CompressionOptions): Uint8Array;

export function compress<OutputT, InputT>(
    output: OutputStream<OutputT, InputT>,
    input: InputStream<OutputT, InputT>,
    opts?: LZ4CompressionOptions): Generator<OutputT, void, InputT>;

export function compress(...args: any[]) {
    switch (args.length) {
        case 1:
            return compressOneShot(args[0]);
        case 2:
            if (args[0] instanceof Uint8Array) {
                return compressOneShot(args[0], args[1]);
            }
            else {
                return compressStream(args[0], args[1]);
            }
        case 3:
            return compressStream(args[0], args[1], args[2]);
        default:
            throw new Error("Wrong number of arguments");
    }
}

function compressOneShot(input: Uint8Array, opts?: LZ4CompressionOptions): Uint8Array {
    const os  = new BufferOutputStream();
    const is  = new BufferInputStream(new Buffer(input));
    const gen = new LZ4Compressor(os, is, opts).run();

    if (!gen.next().done) {
        throw new Error("Internal error: the generator yielded when it shouldn't");
    }

    return os.data.toUint8Array();
}

function compressStream<OutputT, InputT>(
    output: OutputStream<OutputT, InputT>,
    input: InputStream<OutputT, InputT>,
    opts?: LZ4CompressionOptions): Generator<OutputT, void, InputT> {

    output.onYield((data) => input.gotData(data));
    input.onYield(() => output.takeData());

    return new LZ4Compressor(output, input, opts).run();
}

interface Block {
    rawBlock:  Buffer,
    compBlock: Buffer
}

class LZ4Compressor<OutputT, InputT> {
    readonly #output: OutputStream<OutputT, InputT>;
    readonly #input: InputStream<OutputT, InputT>;
    readonly #opts: Required<LZ4CompressionOptions>;
    readonly #hashSize: number;
    readonly #dictHashTable: Uint16Array;
    readonly #dictionary: Buffer;

    public constructor(output: OutputStream<OutputT, InputT>,
                       input: InputStream<OutputT, InputT>,
                       opts?: LZ4CompressionOptions) {
        this.#output = output;
        this.#input  = input;
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
        if (this.#opts.hashBits < 0 || this.#opts.hashBits > 32) {
            throw new RangeError(`hashBits must be in [0, 32]: ${this.#opts.hashBits}`);
        }
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
            this.#dictionary.unsafeAppend(input.unsafeSubarray(-0xFFFF));

            // And every offset in the dictionary hash table is now
            // invalid. Need to rebuild it entirely.
            this.#hashDictionary();
        }
        else if (this.#dictionary.length + input.length > 0xFFFF) {
            // Some part of our existing dictionary is going away.
            this.#dictionary.unsafeAppend(input.unsafeSubarray(-0xFFFF));
            this.#dictionary.drop(this.#dictionary.length - 0xFFFF);

            // This means every offset in it is now invalid.
            this.#hashDictionary();
        }
        else {
            // Our dictionary is only growing. Offsets aren't going to be
            // invalidated.
            const oldDictSize = this.#dictionary.length;
            this.#dictionary.unsafeAppend(input);

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
        // other hand we can only use can't use the entirety of the hash
        // values anyway, so full avalanche is an overkill. The function we
        // use here has a good quality in low bits:
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

    public *run(): Generator<OutputT, void, InputT> {
        yield* this.#output.writeUint32(0x184D2204, true); // magic

        yield* writeFrameDescriptor(this.#output, {
            independentBlocks: this.#opts.independentBlocks,
            blockChecksums:    this.#opts.blockChecksums,
            contentSize:       this.#opts.contentSize,
            contentChecksum:   this.#opts.contentChecksum,
            dictionaryID:      this.#opts.dictionary?.id,
            maximumBlockSize:  this.#opts.maximumBlockSize
        });

        yield* this.#compressFrame();
    }

    *#compressFrame(): Generator<OutputT, void, InputT> {
        const contentHash = this.#opts.contentChecksum ? new XXH32() : undefined;
        let   contentSize = 0;
        while ((yield* this.#input.isEOF()) == false) {
            // Take the next block from the input and try compressing
            // it. If it doesn't compress, then write it as an uncompressed
            // block. Unfortunately this cannot be implemented as a
            // one-pass operation and we have to keep the entire block in
            // memory.
            const {rawBlock, compBlock} = yield* this.#compressBlock();

            if (compBlock.length >= rawBlock.length) {
                // Damn, it made no sense to compress it. Write an
                // uncompressed block and discard the other one.
                yield* this.#output.writeUint32(rawBlock.length | 0x80, true);
                yield* this.#output.unsafeWrite(rawBlock);
                if (this.#opts.blockChecksums) {
                    yield* this.#output.writeUint32(xxHash32(rawBlock), true);
                }
            }
            else {
                // It actually compressed.
                yield* this.#output.writeUint32(compBlock.length, true);
                yield* this.#output.unsafeWrite(compBlock);
                if (this.#opts.blockChecksums) {
                    yield* this.#output.writeUint32(xxHash32(compBlock), true);
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
        yield* this.#output.writeUint32(0, true);

        if (this.#opts.contentSize !== undefined) {
            if (this.#opts.contentSize != contentSize) {
                throw new Error(`Content size mismatches: expected ${this.#opts.contentSize}, got ${contentSize}`);
            }
        }

        if (contentHash) {
            yield* this.#output.writeUint32(contentHash.final(), true);
        }
    }

    *#compressBlock(): Generator<OutputT, Block, InputT> {
        // Read an entire block from the stream. This is unavoidable,
        // because we must retain it in memory anyway in order to decide if
        // we should write a compressed block or not.
        const rawBlock  = new Buffer();
        const compBlock = new Buffer();
        for (let remaining = this.#opts.maximumBlockSize; remaining > 0; ) {
            const chunk = yield* this.#input.readSome(remaining);
            if (chunk) {
                rawBlock.unsafeAppend(chunk);
            }
            else {
                break;
            }
        }

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
                        compBlock, rawBlock.unsafeSubarray(literalStart, blockPos),
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
                        compBlock, rawBlock.unsafeSubarray(literalStart, blockPos),
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

        this.#writeLiteral(compBlock, rawBlock.unsafeSubarray(literalStart));
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
        compBlock.unsafeAppend(literal);
    }
}
