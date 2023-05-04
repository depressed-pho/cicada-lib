import { toUint8Array, toDataView } from "../typed-array.js";
import { XXH32, xxHash32 } from "../xxHash32.js";
import { LZ4MaximumBlockSize, LZ4CompressionOptions } from "./options.js";
import { MAX_FRAME_DESCRIPTOR_LENGTH, LZ4FrameDescriptor, writeFrameDescriptor } from "./frame.js";

export class LZ4Compressor {
    readonly #opts: Required<LZ4CompressionOptions>;
    readonly #contentHasher: XXH32|null;
    readonly #hashSize: number;
    readonly #blockHashTable: Uint32Array;
    readonly #dictHashTable: Uint16Array;
    readonly #dictionary: Uint8Array;
    #dictSize: number;
    #hasProducedHeader: boolean;
    #hasFinalised: boolean;

    public constructor(opts?: LZ4CompressionOptions) {
        this.#opts = {
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

        this.#contentHasher     = this.#opts.contentChecksum ? new XXH32() : null;
        this.#hashSize          = 2 ** this.#opts.hashBits - 1 >>> 0;
        this.#blockHashTable    = new Uint32Array(this.#hashSize);
        this.#dictHashTable     = new Uint16Array(this.#hashSize);
        this.#dictionary        = new Uint8Array(0xFFFF);
        this.#dictSize          = 0;
        this.#hasProducedHeader = false;
        this.#hasFinalised      = false;

        if (this.#opts.dictionary) {
            this.#populateDict(toUint8Array(this.#opts.dictionary.data));
        }
    }

    get #frameDescriptor(): LZ4FrameDescriptor {
        return {
            independentBlocks: this.#opts.independentBlocks,
            blockChecksums:    this.#opts.blockChecksums,
            contentSize:       this.#opts.contentSize,
            contentChecksum:   this.#opts.contentChecksum,
            dictionaryID:      this.#opts.dictionary?.id,
            maximumBlockSize:  this.#opts.maximumBlockSize
        };
    }

    #populateDict(input: Uint8Array): void {
        if (input.byteLength >= 0xFFFF) {
            // The input is going to completely wash our dictionary
            // away. Take the last 64 KiB of the input.
            const dictStart = input.byteLength - 0xFFFF;
            const dictEnd   = dictStart        + 0xFFFF;
            const dictView  = input.subarray(dictStart, dictEnd);
            this.#dictionary.set(dictView);
            this.#dictSize = 0xFFFF;

            // And every offset in the dictionary hash table is now
            // invalid. Need to rebuild it entirely.
            this.#dictHashTable.fill(0);
            this.#hashDictionary();
        }
        else if (this.#dictSize + input.byteLength > 0xFFFF) {
            // Some part of our existing dictionary is going away.
            const numErase = this.#dictSize + input.byteLength - 0xFFFF;
            this.#dictionary.copyWithin(0, numErase);
            this.#dictionary.set(input, 0xFFFF - input.byteLength);
            this.#dictSize = 0xFFFF;

            // This means every offset in it is now invalid.
            this.#dictHashTable.fill(0);
            this.#hashDictionary();
        }
        else {
            // Our dictionary is only growing. Offsets aren't going to be
            // invalidated.
            const oldDictSize = this.#dictSize;
            this.#dictionary.set(input, this.#dictSize);
            this.#dictSize += input.byteLength;

            // But since the last 3 octets of the dictionary hasn't been
            // hashed, we now need to do it.
            this.#hashDictionary(Math.max(0, oldDictSize - 3));
        }
    }

    #hashDictionary(startPos = 0): void {
        const dictView = new DataView(this.#dictionary.buffer);
        for (let offset = startPos; offset + 4 <= this.#dictSize; offset++) {
            const word = dictView.getUint32(offset, true);
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

    public update(input: Uint8Array): Uint8Array {
        this.#throwIfFinalised();
        return this.#updateImpl(toDataView(input));
    }

    #throwIfFinalised() {
        if (this.#hasFinalised) {
            throw new Error("The compressor has already been finalised");
        }
    }

    #updateImpl(input: DataView): Uint8Array {
        // Split the input into blocks and compress them immediately. Do
        // not buffer the input until it reaches maximumBlockSize. This
        // results in a suboptimal compression ratio but the whole point of
        // LZ4 is being fast and using minimal amount of memory. If we were
        // to value compression ratio and don't care anything else we would
        // be using LZMA, weren't we?

        if (this.#contentHasher) {
            this.#contentHasher.update(toUint8Array(input));
        }

        // Allocate memory for output by calculating the theoretical worst
        // output size.
        const outBuf = new ArrayBuffer(
            this.#compressionBound(input.byteLength) +
                (this.#hasProducedHeader
                    ? 0
                    : 4 /* magic */ + MAX_FRAME_DESCRIPTOR_LENGTH));
        const output = new DataView(outBuf);
        let   outPos = 0;

        if (!this.#hasProducedHeader) {
            output.setUint32(outPos, 0x184D2204, true); // magic
            outPos += 4;
            outPos = writeFrameDescriptor(outBuf, outPos, this.#frameDescriptor);
            this.#hasProducedHeader = true;
        }

        // We don't keep a copy of the previous input, so our hashtable is
        // totally invalid at this point. Reset it.
        this.#blockHashTable.fill(0);

        // Split the input into blocks and compress them.
        for (let inPos = 0; inPos < input.byteLength; inPos += this.#opts.maximumBlockSize) {
            const blockSize = Math.min(input.byteLength - inPos, this.#opts.maximumBlockSize);
            const inEnd     = inPos + blockSize;

            // Try and see if the block actually compresses. If it doesn't,
            // then write it as an uncompressed block.
            const compPos   = outPos + 4;
            const newPos    = this.#compressBlock(output, compPos, input, inPos, inEnd);
            const compSize  = newPos - compPos;

            if (compSize >= blockSize) {
                // Damn, it made no sense to compress it. Overwrite our
                // wasted attempt with the source.
                output.setUint32(outPos, blockSize | 0x80, true);
                outPos += 4;

                const blockSrc = toUint8Array(input).subarray(inPos, inEnd);
                new Uint8Array(outBuf, outPos, blockSize).set(blockSrc);
                outPos += blockSize;
            }
            else {
                // It actually compressed but we haven't written the block
                // size yet. Do it now.
                output.setUint32(outPos, compSize, true);
                outPos += 4;
                outPos += compSize;
            }

            if (this.#opts.blockChecksums) {
                const block = new Uint8Array(outBuf, compPos, outPos - compPos);
                output.setUint32(outPos, xxHash32(block), true);
                outPos += 4;
            }

            if (this.#opts.independentBlocks) {
                // Independent blocks must never refer to previous blocks
                // so we can't reuse our hashtable. Reset it.
                this.#blockHashTable.fill(0);
            }
        }

        if (!this.#opts.independentBlocks) {
            // Save a copy of the last 64 KiB of the input so that
            // subsequent blocks can find matches in it.
            this.#populateDict(toUint8Array(input));
        }

        return new Uint8Array(outBuf, 0, outPos);
    }

    #compressionBound(sourceLen: number): number {
        const numBlocks = Math.max(1, Math.ceil(sourceLen / this.#opts.maximumBlockSize));
        return sourceLen +
            Math.ceil(sourceLen / 256) + // Literal overhead
            numBlocks * (4 + (this.#opts.blockChecksums ? 4 : 0)) // Block overhead
            | 0;
    }

    #compressBlock(output: DataView, outPos: number,
                   input: DataView, inPos: number, inEnd: number): number {

        const blockStart = inPos;
        const blockSize  = inEnd - inPos;

        if (blockSize < 12) {
            // The last match must start at least 12 octets before the end
            // of block. This block is too short to compress. It makes no
            // sense to analyse it.
            return outPos + blockSize;
        }

        const dictView     = new DataView(this.#dictionary.buffer);
        let numNonMatching = 1 << this.#opts.skipTrigger;
        let literalStart   = blockStart;

        // Matches cannot be any shorter than 4 octets. The last 5 octets
        // must always be a literal.
        while (inPos + 4 <= inEnd - 5) {
            const word = input.getUint32(inPos, true);
            const hash = this.#hashWord(word);

            // Try finding a match in the dictionary first. This has a
            // chance of finding a longer one. But we don't attempt to find
            // a match in the last 3 octets in the dictionary because
            // that's too much effort for a negligible effect.
            const dictPosPlus1 = this.#dictHashTable[hash];
            if (dictPosPlus1 && dictView.getUint32(dictPosPlus1 - 1, true) == word) {
                // Found a matching 4-octets in the dictionary but can we
                // really use it? We need to compute the distance
                // differently for the chained blocks case and independent
                // blocks case.
                const distance = (this.#dictSize - (dictPosPlus1 - 1)) +
                    ( this.#opts.independentBlocks
                        ? inPos - blockStart
                        : inPos
                    );
                if (distance <= 0xFFFF) {
                    // Yes we can. It's not that far away. Now count the
                    // length of the match in the dictionary.
                    const dictMatchLenMinus4 =
                        this.#findMatchLength(
                            dictView, dictPosPlus1 - 1 + 4, this.#dictSize,
                            input, inPos + 4, inEnd);

                    // Can we possibly continue matching on the block too?
                    const blockMatchLen =
                        this.#findMatchLength(
                            input, this.#opts.independentBlocks ? 0 : blockStart, inEnd,
                            input, inPos + 4, inEnd);

                    // Write a sequence and skip the matched part.
                    const matchLenMinus4 = dictMatchLenMinus4 + blockMatchLen;

                    outPos = this.#writeSequence(
                        output, outPos,
                        input, literalStart, inPos,
                        distance, matchLenMinus4);

                    inPos       += matchLenMinus4 + 4;
                    literalStart = inPos;
                    continue;
                }

                // Reset the skip counter regardless of whether we could
                // actually use the match.
                numNonMatching = 1 << this.#opts.skipTrigger;
            }

            // No matches in the dictionary. How about in the past input?
            const blockPosPlus1 = this.#blockHashTable[hash];
            this.#blockHashTable[hash] = inPos + 1;

            if (blockPosPlus1 && input.getUint32(blockPosPlus1 - 1, true) == word) {
                const distance = inPos - (blockPosPlus1 - 1);
                if (distance <= 0xFFFF) {
                    // Found a match which we can use. Note that we don't
                    // have to worry about inter-block matching in the
                    // independent blocks case, because the hash table
                    // shouldn't contain any data about past blocks then.
                    const matchLenMinus4 =
                        this.#findMatchLength(
                            input, blockPosPlus1 - 1 + 4, inEnd,
                            input, inPos + 4, inEnd);

                    // Write a sequence and skip the matched part.
                    outPos = this.#writeSequence(
                        output, outPos,
                        input, literalStart, inPos,
                        distance, matchLenMinus4);

                    inPos       += matchLenMinus4 + 4;
                    literalStart = inPos;
                    continue;
                }

                // Reset the skip counter.
                numNonMatching = 1 << this.#opts.skipTrigger;
            }

            // No matches found. Skip this position.
            const step = numNonMatching++ >> this.#opts.skipTrigger;
            inPos += step;
        }

        if (literalStart == blockStart) {
            // Absolutely nothing in this block could possibly compress. It
            // makes no sense to do anything further.
            return outPos + blockSize;
        }

        return this.#writeLiteral(output, outPos, input, literalStart, inEnd);
    }

    #findMatchLength(dict: DataView, dictPos: number, dictEnd: number,
                     input: DataView, inPos: number, inEnd: number): number {

        // A match must not cover the last 5 octets of a block.
        const stop       = inEnd - 5;
        const matchStart = inPos;

        // Compare 4 octets at once until we reach the last 3.
        for (; dictPos + 4 <= dictEnd && inPos + 4 <= stop; dictPos += 4, inPos += 4) {
            if (dict.getUint32(dictPos, true) != input.getUint32(inPos, true)) {
                break;
            }
        }

        // Compare remaining octets.
        for (; dictPos < dictEnd && inPos < stop; dictPos++, inPos++) {
            if (dict.getUint8(dictPos) != input.getUint8(inPos)) {
                break;
            }
        }

        return inPos - matchStart;
    }

    #writeSequence(output: DataView, outPos: number,
                   input: DataView, literalStart: number, literalEnd: number,
                   distance: number, matchLenMinus4: number): number {

        // Write a token and the literal.
        const newPos = this.#writeLiteral(output, outPos, input, literalStart, literalEnd);

        // Fix up the token so it contains the match length.
        output.setUint8(outPos, output.getUint8(outPos) | Math.min(matchLenMinus4, 0xF));
        outPos          = newPos;
        matchLenMinus4 -= 0xF;

        // Write the offset.
        output.setUint16(outPos, distance, true);
        outPos += 2;

        // Write the remaining match length if it doesn't fit in the token.
        if (matchLenMinus4 >= 0xF) {
            matchLenMinus4 -= 0xF;
            for (; matchLenMinus4 >= 0xFF; matchLenMinus4 -= 0xFF) {
                output.setUint8(outPos, 0xFF);
                outPos++;
            }
            output.setUint8(outPos, matchLenMinus4);
            outPos++;
        }

        return outPos;
    }

    #writeLiteral(output: DataView, outPos: number,
                  input: DataView, literalStart: number, literalEnd: number): number {

        let literalLen = literalEnd - literalStart;

        // Write a token.
        output.setUint8(outPos, Math.min(literalLen, 0xF) << 4);
        outPos++;

        // Write the remaining literal count if it doesn't fit in the token.
        if (literalLen >= 0xF) {
            literalLen -= 0xF;
            for (; literalLen >= 0xFF; literalLen -= 0xFF) {
                output.setUint8(outPos, 0xFF);
                outPos++;
            }
            output.setUint8(outPos, literalLen);
            outPos++;
        }

        // Write the literal.
        const literal = toUint8Array(input).subarray(literalStart, literalEnd);
        toUint8Array(output).set(literal, outPos);
        outPos += literal.byteLength;

        return outPos;
    }

    public final(): Uint8Array {
        this.#throwIfFinalised();

        const outBuf = new ArrayBuffer(
            (this.#hasProducedHeader
                ? 0
                : 4 + MAX_FRAME_DESCRIPTOR_LENGTH) +
            4 + // EndMark
            (this.#contentHasher ? 4 : 0));
        const out    = new DataView(outBuf);
        let   outPos = 0;

        if (!this.#hasProducedHeader) {
            out.setUint32(outPos, 0x184D2204, true); // magic
            outPos += 4;
            outPos = writeFrameDescriptor(outBuf, outPos, this.#frameDescriptor);
            this.#hasProducedHeader = true;
        }

        // EndMark
        out.setUint32(outPos, 0, true);
        outPos += 4;

        if (this.#contentHasher) {
            out.setUint32(outPos, this.#contentHasher.final(), true);
            outPos += 4;
        }

        return new Uint8Array(outBuf, 0, outPos);
    }
}
