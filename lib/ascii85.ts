const POW_85 = new Uint32Array([
    85*85*85*85,
    85*85*85,
    85*85,
    85,
    1
]);

/** Decode a sequence of octets in Ascii85
 * (https://en.wikipedia.org/wiki/Ascii85). The function ignores
 * whitespaces.
 */
export function a85Decode(str: string): Uint8Array {
    // The space needed for the octet sequence is usually not larger than
    // str.length*4/5, but there is a chance it exceeds that because of
    // 'z'. When that happens we reallocate the buffer.
    const iLen    = str.length;
    let   iPos    = 0;
    let   bufLen  = Math.ceil(str.length * 4 / 5);
    let   buf     = new Uint8Array(bufLen);
    let   bufPos  = 0;
    let   word    = 0;
    let   wordPos = 0;

    while (true) {
        const hasMore = iPos < iLen;

        if (!hasMore ||
            (wordPos == 0 && bufLen - bufPos < 4)) {
            // Either there's no more characters or there's no room for 4
            // octets.
            if (hasMore) {
                const rem  = Math.max(4, Math.ceil((iLen - iPos) * 4 / 5));
                const buf2 = new Uint8Array(bufPos + rem);
                buf2.set(buf.subarray(0, bufPos));
                buf = buf2;
            }
            else {
                // There's no more characters, but was the last word
                // complete?
                if (wordPos != 0) {
                    // No. Decode the leftover.
                    if (wordPos === 1) {
                        // But this is invalid because we cannot
                        // reconstruct the original octet from just a
                        // single ASCII character.
                        throw new TypeError("Incomplete Ascii85 string");
                    }
                    else {
                        // Do we have a room for the last word?
                        if (bufLen - bufPos < wordPos - 1) {
                            const buf2 = new Uint8Array(bufPos+1 + wordPos-1);
                            buf2.set(buf.subarray(0, bufPos));
                            buf = buf2;
                        }
                        word   += POW_85[--wordPos]!;
                        bufPos += a85DecodeWord(buf, bufPos, word, wordPos);
                    }
                }
                // There is a space/time tradeoff here. We use
                // buf.subarray() and we waste space. We use buf.slice()
                // and we waste time. For now we just waste time in favour
                // of space but maybe we can do something smarter in the
                // future, like thresholding the amount of memory to be
                // wasted.
                return buf.slice(0, bufPos);
            }
        }

        const c = str.charCodeAt(iPos++);
        switch (c) {
            case 0x7a: // 'z'
                if (wordPos === 0) {
                    bufPos += a85DecodeWord(buf, bufPos, 0, 4);
                }
                else {
                    throw new TypeError(`Invalid 'z' character at position ${iPos}`);
                }
                break;
            case 0x09: // TAB
            case 0x0A: // LF
            case 0x0D: // CR
            case 0x20: // SPC
                continue;
            default:
                if (c >= 0x21 && c <= 0x75) { // '!' .. 'u'
                    word += (c - 0x21) * POW_85[wordPos++]!;
                    if (wordPos == 5) {
                        bufPos += a85DecodeWord(buf, bufPos, word, 4);
                        word    = 0;
                        wordPos = 0;
                    }
                }
                else {
                    throw new TypeError(`Invalid character \`${str[iPos]}' at position ${iPos}`);
                }
        }
    }
}

function a85DecodeWord(buf: Uint8Array, bufPos: number, word: number, wordLen: number): number {
    if (word > 0xFFFFFFFF) {
        throw new TypeError("Invalid word: greater than 0xFFFFFFFF");
    }
    else {
        for (let wordPos = 0; wordPos < wordLen; wordPos++) {
            buf[bufPos++] = (word >> (24 - wordPos * 8)) & 0xFF;
        }
        return wordLen;
    }
}

/** Encode a sequence of octets in Ascii85
 * (https://en.wikipedia.org/wiki/Ascii85). The function does not insert
 * newlines.
 */
export function a85Encode(octets: BufferSource): string {
    if (octets instanceof Uint8Array) {
        return a85EncodeImpl(octets);
    }
    else if (octets instanceof ArrayBuffer) {
        return a85EncodeImpl(new Uint8Array(octets));
    }
    else {
        // It's either a non-Uint8 TypedArray or a DataView.
        return a85EncodeImpl(new Uint8Array(octets.buffer));
    }
}

function a85EncodeImpl(octets: Uint8Array): string {
    const chunks: string[] = [];

    const iLen    = octets.length;
    let   iPos    = 0;
    let   word    = 0;
    let   wordPos = 0;

    // Create a working buffer for Ascii85 characters. It is at most 5/4
    // times longer than the octet sequence.
    const chunkLen = Math.min(65535, Math.ceil(iLen / 4 * 5) + 5);
    const chunk    = new Uint8Array(chunkLen);
    let   chunkPos = 0;

    while (true) {
        const hasMore = iPos < iLen;

        if (!hasMore ||
            (wordPos == 0 && chunkPos >= chunkLen - 4)) {
            // Either there's no more octets or there's no room for 5 ASCII
            // letters.
            const completeChunk = chunk.subarray(0, chunkPos);
            chunks.push(String.fromCharCode(...completeChunk));
            chunkPos = 0;

            if (hasMore) {
                octets = octets.subarray(iPos);
                iPos   = 0;
            }
            else {
                // There's no more octets, but was the last word complete?
                if (wordPos != 0) {
                    // No. Encode the leftover.
                    chunkPos += a85EncodeWord(chunk, chunkPos, word, wordPos);
                    const lastChunk = chunk.subarray(0, chunkPos);
                    chunks.push(String.fromCharCode(...lastChunk));
                }
                return chunks.join("");
            }
        }

        const o = octets[iPos++]!;
        switch (wordPos) {
            case 0:
                word  = o << 24;
                wordPos++;
                break;
            case 1:
                word |= o << 16;
                wordPos++;
                break;
            case 2:
                word |= o <<  8;
                wordPos++;
                break;
            case 3:
                word     |= o;
                chunkPos += a85EncodeWord(chunk, chunkPos, word, 4);
                word      = 0;
                wordPos   = 0;
                break;
        }
    }
}

function a85EncodeWord(chunk: Uint8Array, chunkPos: number, word: number, wordLen: number): number {
    if (word === 0 && wordLen === 4) {
        // Special case: "z" instead of "!!!!!".
        chunk[chunkPos] = 0x7a;
        return 1;
    }
    else {
        // We believe n|0 is faster than Math.floor(n).
        chunk[chunkPos+4] = (word % 85) + 0x21; word = (word / 85) | 0;
        chunk[chunkPos+3] = (word % 85) + 0x21; word = (word / 85) | 0;
        chunk[chunkPos+2] = (word % 85) + 0x21; word = (word / 85) | 0;
        chunk[chunkPos+1] = (word % 85) + 0x21; word = (word / 85) | 0;
        chunk[chunkPos  ] = (word % 85) + 0x21;
        return wordLen + 1;
    }
}
