/** The Bedrock API lacks TextEncoder:
 * https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder
 */
import { installGlobal } from "./_util.js";

const VALID_ENCODING_LABELS = new Set(["unicode-1-1-utf-8", "utf-8", "utf8"]);
const REPLACEMENT_CHARACTER = 0xFFFD;
const BYTE_ORDER_MARK       = 0xFEFF;

enum DecodingState {
    INIT, // The next octet will be the first one of a sequence.
    TWO,  // We are in the middle of a two-octets sequence.
    THREE,
    FOUR,
    INVALID // We are in the middle of an invalid sequence.
}

class TextDecoderShim {
    readonly encoding: string;
    readonly fatal: boolean;
    readonly ignoreBOM: boolean;
    #state: DecodingState;
    readonly #pending: Uint8Array; // Always 3 octets long.
    #pendingPos: number;  // 0 means we are at a border of UTF-8 character sequence.
    #chunk: Uint16Array|null;
    #chunkPos: number;

    constructor(label = "utf-8", opts?: TextDecoderShimOptions) {
        if (!VALID_ENCODING_LABELS.has(label)) {
            throw new RangeError(`Unsupported encoding: ${label}`);
        }
        this.encoding    = label;
        this.fatal       = opts?.fatal     ?? false;
        this.ignoreBOM   = opts?.ignoreBOM ?? false;
        this.#state      = DecodingState.INIT;
        this.#pending    = new Uint8Array(3);
        this.#pendingPos = 0;
        this.#chunk      = null;
        this.#chunkPos   = 0;
    }

    decode(octets?: BufferSource, opts?: TextDecodeShimOptions): string {
        if (octets === undefined || octets instanceof Uint8Array) {
            return this.#decode(octets, opts);
        }
        else if (octets instanceof ArrayBuffer) {
            return this.#decode(new Uint8Array(octets), opts);
        }
        else {
            // It's either a non-Uint8 TypedArray or a DataView.
            return this.#decode(new Uint8Array(octets.buffer), opts);
        }
    }

    #decode(octets?: Uint8Array, opts?: TextDecodeShimOptions): string {
        if (octets === undefined) {
            // There's no more octets, but was the last
            // character complete?
            this.#chunk    = null;
            this.#chunkPos = 0;
            if (this.#state !== DecodingState.INIT && !opts?.stream) {
                // No, and the caller isn't going to give us
                // more.
                if (this.fatal) {
                    throw new TypeError(`Premature end of a UTF-8 sequence`);
                }
                else {
                    return String.fromCharCode(REPLACEMENT_CHARACTER);
                }
            }
            else {
                return "";
            }
        }
        else {
            let   iPos = 0;
            const iLen = octets.length;
            const chunks: string[] = [];

            // Create a working buffer for UCS-16 code points. UTF-8 to UCS-16
            // conversion is at most 1:1 and at least 2:1.
            let chunkLen = Math.min(65535, iLen + 1);
            if (this.#chunk) {
                // But there is a leftover from the previous run. Allocate
                // more if it's too small, but don't bother to shrink it
                // down.
                if (this.#chunk.length < chunkLen) {
                    const buf2 = new Uint16Array(chunkLen);
                    buf2.set(this.#chunk.subarray(0, this.#chunkPos));
                    this.#chunk = buf2;
                }
                else {
                    chunkLen = this.#chunk.length;
                }
            }
            else {
                this.#chunk = new Uint16Array(chunkLen);
            }

            while (true) {
                const hasMore = iPos < iLen;

                if (!hasMore ||
                    (this.#state === DecodingState.INIT &&
                        chunkLen - this.#chunkPos < 2)) {
                    // Either there's no more octets or there's no room for
                    // two UCS-16 code points (two because a single Unicode
                    // code point can result in a surrogate pair).
                    const completeChunk = this.#chunk.subarray(0, this.#chunkPos);
                    chunks.push(String.fromCharCode(...completeChunk));

                    if (hasMore) {
                        octets         = octets.subarray(iPos);
                        iPos           = 0;
                        this.#chunkPos = 0;
                    }
                    else {
                        // There's no more octets, but was the last
                        // character complete?
                        this.#chunk    = null;
                        this.#chunkPos = 0;
                        const str      = chunks.join("");
                        if (this.#state !== DecodingState.INIT && !opts?.stream) {
                            // No, and the caller isn't going to give us
                            // more.
                            if (this.fatal) {
                                throw new TypeError(`Premature end of a UTF-8 sequence after: ${str}`);
                            }
                            else {
                                return str + String.fromCharCode(REPLACEMENT_CHARACTER);
                            }
                        }
                        else {
                            return str;
                        }
                    }
                }

                const o = octets[iPos++]!;
                if (this.#state === DecodingState.INIT) {
                    if ((o & 0x80) === 0) { // 1 octet
                        // There is no way the ASCII letter can be a BOM.
                        this.#chunk[this.#chunkPos++] = o;
                    }
                    else {
                        if ((o & 0xE0) === 0xC0) { // 2 octets
                            this.#state = DecodingState.TWO;
                        }
                        else if ((o & 0xF0) === 0xE0) { // 3 octets
                            this.#state = DecodingState.THREE;
                        }
                        else if ((o & 0xF8) === 0xF0) { // 4 octets
                            this.#state = DecodingState.FOUR;
                        }
                        else {
                            if (this.fatal) {
                                const str = chunks.join("");
                                throw new TypeError(`Invalid initial octet ${o}: ${str}`);
                            }
                            else {
                                // Skip until we get the next 0xxxxxxx
                                // (1 octet) or 11xxxxxx (initial).
                                this.#chunk[this.#chunkPos++] = REPLACEMENT_CHARACTER;
                                this.#state = DecodingState.INVALID;
                            }
                        }
                        this.#pending[0] = o;
                        this.#pendingPos = 1;
                    }
                }
                else if (this.#state === DecodingState.INVALID) {
                    if ((o & 0x80) === 0 || ((o & 0xC0) === 0xC0)) {
                        // A good-looking octet has appeared. Read it again
                        // in the next iteration.
                        iPos--;
                        this.#state      = DecodingState.INIT;
                        this.#pendingPos = 0;
                    }
                }
                else {
                    if ((o & 0xC0) === 0x80) {
                        if (this.#state === DecodingState.TWO && this.#pendingPos === 1) {
                            const c =
                                ((this.#pending[0]! & 0x1F) << 6) | (o & 0x3F);
                            if (!this.ignoreBOM || c != BYTE_ORDER_MARK) {
                                this.#chunk[this.#chunkPos++] = c;
                            }
                            this.#state      = DecodingState.INIT;
                            this.#pendingPos = 0;
                        }
                        else if (this.#state === DecodingState.THREE && this.#pendingPos === 2) {
                            const c =
                                ((this.#pending[0]! & 0x0F) << 12) |
                                ((this.#pending[1]! & 0x3F) <<  6) | (o & 0x3F);
                            if (!this.ignoreBOM || c != BYTE_ORDER_MARK) {
                                this.#chunk[this.#chunkPos++] = c;
                            }
                            this.#state      = DecodingState.INIT;
                            this.#pendingPos = 0;
                        }
                        else if (this.#state === DecodingState.FOUR && this.#pendingPos === 3) {
                            const c =
                                ((this.#pending[0]! & 0x07) << 18) |
                                ((this.#pending[1]! & 0x3F) << 12) |
                                ((this.#pending[2]! & 0x3F) <<  6) | (o & 0x3F);
                            if (c > 0xFFFF) {
                                // It has to be represented as a surrogate pair.
                                const c2 = c - 0x10000;
                                this.#chunk[this.#chunkPos++] = 0xD800 | ((c2 >>> 10) & 0x3FF);
                                this.#chunk[this.#chunkPos++] = 0xDC00 | ( c2         & 0x3FF);
                            }
                            else if (!this.ignoreBOM || c != BYTE_ORDER_MARK) {
                                this.#chunk[this.#chunkPos++] = c;
                            }
                            this.#state      = DecodingState.INIT;
                            this.#pendingPos = 0;
                        }
                        else {
                            this.#pending[this.#pendingPos] = o;
                            this.#pendingPos++;
                        }
                    }
                    else {
                        if (this.fatal) {
                            const str = chunks.join("");
                            throw new TypeError(`Invalid UTF-8 sequence after: ${str}`);
                        }
                        else {
                            this.#chunk[this.#chunkPos++] = REPLACEMENT_CHARACTER;
                            this.#state = DecodingState.INVALID;
                        }
                    }
                }
            }
        }
    }
}

interface TextDecoderShimOptions {
    fatal?: boolean;
    ignoreBOM?: boolean;
}

interface TextDecodeShimOptions {
    stream?: boolean;
}

installGlobal("TextDecoder", TextDecoderShim);
