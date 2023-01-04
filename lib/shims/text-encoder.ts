/** The Bedrock API lacks TextEncoder:
 * https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder
 */
import { installGlobal } from "./_util.js";

class TextEncoderShim {
    public get encoding(): string {
        return "utf-8";
    }

    public encode(str: string): Uint8Array {
        // The space needed for the string is never smaller than str.length
        // and never larger than str.length*3. So we optimistically
        // allocate str.length*2+5 octets and then reallocate the buffer
        // when it turns out to be too small.
        const iLen = str.length;
        let   iPos = 0;
        let   oPos = 0;
        let   buf  = new Uint8Array(str.length * 2 + 5);
        let   res  = this.encodeInto(str, buf);
        iPos += res.read;
        oPos += res.written;
        while (iPos < iLen) {
            const rem  = (iLen - iPos) * 2 + 5;
            const buf2 = new Uint8Array(oPos + rem);
            buf2.set(buf.subarray(0, oPos));
            buf   = buf2;
            res   = this.encodeInto(str.slice(iPos), buf.subarray(oPos));
            iPos += res.read;
            oPos += res.written;
        }
        // There is a space/time tradeoff here. We use buf.subarray() and
        // we waste space. We use buf.slice() and we waste time. For now we
        // just waste time in favour of space but maybe we can do something
        // smarter in the future, like thresholding the amount of memory to
        // be wasted.
        return buf.slice(0, oPos);
    }

    public encodeInto(str: string, buf: Uint8Array): TextEncoderShimEncodeIntoResult {
        const iLen = str.length;
        let   iPos = 0;
        let   read = 0;

        const oLen = buf.length;
        let   oPos = 0;

        while (iPos < iLen) {
            let c = str.charCodeAt(iPos++);
            if (c >= 0xD800 && c <= 0xDBFF) {
                // It's a surrogate pair.
                if (iPos < iLen) {
                    const c2 = str.charCodeAt(iPos++);
                    if ((c2 & 0xFC00) == 0xDC00) {
                        c = ((c & 0x3FF) << 10) + (c2 & 0x3FF) + 0x10000;
                    }
                    else {
                        throw new TypeError(`Invalid surrogate pair at position ${iPos}: ${str}`);
                    }
                }
                else {
                    throw new TypeError(`Incomplete surrogate pair at the end: ${str}`);
                }
            }

            // Now we got a complete code point but can we write it to the
            // buffer?
            if ((c & 0xFFFFFF80) === 0) { // 1 octet
                if (oLen - oPos >= 1) {
                    buf[oPos++] = c;
                }
                else {
                    break;
                }
            }
            else if ((c & 0xFFFFF800) === 0) { // 2 octets
                if (oLen - oPos >= 2) {
                    buf[oPos++] = ((c >>>  6) & 0x1F) | 0xC0;
                    buf[oPos++] = ( c         & 0x3F) | 0x80;
                }
                else {
                    break;
                }
            }
            else if ((c & 0xFFFF0000) === 0) { // 3 octets
                if (oLen - oPos >= 3) {
                    buf[oPos++] = ((c >>> 12) & 0x0F) | 0xE0;
                    buf[oPos++] = ((c >>>  6) & 0x3F) | 0x80;
                    buf[oPos++] = ( c         & 0x3F) | 0x80;
                }
                else {
                    break;
                }
            }
            else if ((c & 0xFFE00000) === 0) { // 4 octets
                if (oLen - oPos >= 4) {
                    buf[oPos++] = ((c >>> 18) & 0x07) | 0xF0;
                    buf[oPos++] = ((c >>> 12) & 0x3F) | 0x80;
                    buf[oPos++] = ((c >>>  6) & 0x3F) | 0x80;
                    buf[oPos++] = ( c         & 0x3F) | 0x80;
                }
                else {
                    break;
                }
            }
            // Reaching here means that we could successfully write the
            // last sequence. Now we can update the read counter.
            read = iPos;
        }

        return {
            read: read,
            written: oPos
        };
    }
}

interface TextEncoderShimEncodeIntoResult {
    read: number;
    written: number;
}

installGlobal("TextEncoder", TextEncoderShim);
