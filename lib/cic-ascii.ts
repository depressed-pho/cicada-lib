import { toDataView } from "./typed-array.js";
import { xxHash32 } from "./xxhash.js";
import * as A85 from "./ascii85.js";
import * as LZ4 from "./lz4.js";

/** Encode an octet stream to an ASCII string with reasonably small
 * overhead. The octet stream is encoded in Ascii85 (see
 * https://en.wikipedia.org/wiki/Ascii85) with the following header
 * prepended (before encoding, not after):
 *
 * +----------+---------+-------------+
 * | Magic    | Version | Compression |
 * | 4 octets | 1 octet | 1 octet     |
 * +==========+=========+=============+
 * |  'CICA'  |   0x01  |     0x00    |
 * +----------+---------+-------------+
 *
 * Compression schemes:
 *
 *   * 0x00 "no compression":
 *       The payload is not compressed, and has a 32-bit xxHash checksum in
 *       big-endian is appended to it.
 *
 *   * 0x01 LZ4:
 *       The payload is compressed as a LZ4 frame, with no predefined
 *       dictionaries. The LZ4 frame SHOULD have a content checksum.
 */
export function encode(payload: Uint8Array): string {
    // Try compressing the payload. Does it work?
    const comp = LZ4.compress(payload, {contentChecksum: true});

    if (comp.byteLength < payload.byteLength + 4) {
        // Yes it compressed.
        const u8 = new Uint8Array(6 + comp.byteLength);
        const dv = toDataView(u8);
        dv.setUint32(0, 0x43494341); // 'CICA'
        dv.setUint8 (4, 0x01);       // Version
        dv.setUint8 (5, 0x01);       // LZ4
        u8.set(comp, 6);
        return A85.encode(u8);
    }
    else {
        // It didn't.
        const u8 = new Uint8Array(6 + payload.byteLength + 4);
        const dv = toDataView(u8);
        dv.setUint32(0, 0x43494341); // 'CICA'
        dv.setUint8 (4, 0x01);       // Version
        dv.setUint8 (5, 0x00);       // "no compression"
        u8.set(payload, 6);
        dv.setUint32(6 + payload.byteLength, xxHash32(payload));
        return A85.encode(u8);
    }
}

export function decode(str: string): Uint8Array {
    const buf = A85.decode(str);
    if (buf.length < 6) {
        throw new RangeError(`Truncated CicASCII header: ${str}`);
    }
    else if (buf[0] != 0x43 || buf[1] != 0x49 || buf[2] != 0x43 || buf[3] != 0x41) {
        throw new RangeError("Bad magic for CicASCII");
    }
    else {
        switch (buf[4]) {
            case 0x01:
                return decodeV1(buf);
            default:
                throw new RangeError(`Unknown Cic-ASCII version: ${buf[4]}`);
        }
    }
}

function decodeV1(buf: Uint8Array): Uint8Array {
    switch (buf[5]) {
        case 0x00: // No compression
            if (buf.length < 10) {
                throw new RangeError("Truncated payload of CicASCII");
            }
            else {
                const dv          = toDataView(buf);
                const payload     = buf.subarray(6, -4);
                const expectedSum = dv.getUint32(dv.byteLength - 4);
                const actualSum   = xxHash32(payload);

                if (expectedSum == actualSum) {
                    return payload;
                }
                else {
                    throw new RangeError(`CicASCII checksum mismatches: expected ${expectedSum.toString(16)}, got ${actualSum.toString(16)}`);
                }
            }

        case 0x01: // LZ4
            return LZ4.decompress(buf.subarray(6));

        default:
            throw new RangeError(`Unknown compression scheme: ${buf[5]}`);
    }
}
