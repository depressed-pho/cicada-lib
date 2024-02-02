import { Buffer } from "../buffer.js";
import { Conduit, awaitC, conduit, yieldC, sinkBuffer } from "../conduit.js";
import { lazy } from "../lazy.js";

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
export function decode(str: string): Uint8Array {
    return yieldC(str)
        .fuse(decodeC)
        .fuse(sinkBuffer)
        .run()
        .toUint8Array();
}

export const decodeC: Conduit<string, Buffer, void> =
    lazy(() =>
        conduit(function* () {
            let iPos    = 0;
            let word    = 0;
            let wordPos = 0;
            while (true) {
                const chunk = yield* awaitC;
                if (chunk) {
                    for (let i = 0; i < chunk.length; i++) {
                        const c = chunk.charCodeAt(i);
                        switch (c) {
                            case 0x7A: // 'z'
                                if (wordPos == 0)
                                    yield* yieldC(decodeWord(0, 4));
                                else
                                    throw new Error(`Invalid 'z' character at position ${iPos}`);
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
                                        yield* yieldC(decodeWord(word, 4));
                                        word    = 0;
                                        wordPos = 0;
                                    }
                                }
                                else {
                                    throw new Error(
                                        `Invalid character \`${chunk[i]}' at position ${iPos}`);
                                }
                        }
                        iPos++;
                    }
                }
                else {
                    // There's no more characters, but was the last word
                    // complete?
                    if (wordPos > 0) {
                        // No. Decode the leftover.
                        if (wordPos == 1)
                            // But this is invalid because we cannot
                            // reconstruct the original octet from just a
                            // single ASCII character.
                            throw new Error("Incomplete Ascii85 string");
                        word += POW_85[--wordPos]!;
                        yield* yieldC(decodeWord(word, wordPos));
                    }
                    return;
                }
            }
        }));

function decodeWord(word: number, wordLen: number): Buffer {
    if (word > 0xFFFFFFFF)
        throw new Error("Invalid word: greater than 0xFFFFFFFF");

    const buf = new Buffer();
    buf.reserve(wordLen);
    for (let i = 0; i < wordLen; i++)
        buf.appendUint8((word >> (24 - i * 8)) & 0xFF);
    return buf;
}
