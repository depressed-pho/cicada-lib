import { Buffer, Conduit, awaitC, conduit, yieldC, sinkString } from "../stream.js";

/** Encode a sequence of octets in Ascii85
 * (https://en.wikipedia.org/wiki/Ascii85). The function does not insert
 * newlines.
 */
export function encode(octets: Uint8Array|Buffer): string {
    return yieldC(octets instanceof Buffer ? octets : new Buffer(octets))
        .fuse(encodeC)
        .fuse(sinkString)
        .run();
}

export const encodeC: Conduit<Buffer, string, void> =
    conduit(function* () {
        let word    = 0;
        let wordPos = 0;
        while (true) {
            const chunk = yield* awaitC;
            if (chunk) {
                for (const o of chunk) {
                    switch (wordPos) {
                        case 0:
                            word =         (o << 24)  >>> 0;
                            wordPos++;
                            break;
                        case 1:
                            word = (word | (o << 16)) >>> 0;
                            wordPos++;
                            break;
                        case 2:
                            word = (word | (o <<  8)) >>> 0;
                            wordPos++;
                            break;
                        case 3:
                            word = (word |  o       ) >>> 0;
                            yield* yieldC(encodeWord(word, 4));
                            word    = 0;
                            wordPos = 0;
                            break;
                    }
                }
            }
            else {
                // There's no more octets, but was the last word complete?
                if (wordPos > 0)
                    // No. Encode the leftover.
                    yield* yieldC(encodeWord(word, wordPos));
                return;
            }
        }
    });

function encodeWord(word: number, wordLen: number): string {
    if (word == 0 && wordLen == 4) {
        // Special case: "z" instead of "!!!!!".
        return "z";
    }
    else {
        // We believe n|0 is faster than Math.floor(n).
        const chunk = [];
        chunk[4] = (word % 85) + 0x21; word = (word / 85) | 0;
        chunk[3] = (word % 85) + 0x21; word = (word / 85) | 0;
        chunk[2] = (word % 85) + 0x21; word = (word / 85) | 0;
        chunk[1] = (word % 85) + 0x21; word = (word / 85) | 0;
        chunk[0] = (word % 85) + 0x21;
        return String.fromCharCode(...(chunk.slice(0, wordLen + 1)));
    }
}
