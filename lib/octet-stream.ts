import { a85Decode, a85Encode } from "./ascii85.js";

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
 * The compression code is always zero which means "no compression". We
 * want to support LZ4 (https://github.com/Benzinga/lz4js) in the future,
 * but we haven't done yet.
 */
export function encodeOctets(octets: Uint8Array): string {
    const buf = new Uint8Array(octets.length + 6);
    buf[0] = 0x43; // 'C'
    buf[1] = 0x49; // 'I'
    buf[2] = 0x43; // 'C'
    buf[3] = 0x41; // 'A'
    buf[4] = 0x01; // Version
    buf[5] = 0x00; // Compression
    buf.set(octets, 6);
    return a85Encode(buf);
}

export function decodeOctets(str: string): Uint8Array {
    const buf = a85Decode(str);
    if (buf.length < 6) {
        throw new RangeError(`Truncated octet stream header: ${str}`);
    }
    else if (buf[0] != 0x43 || buf[1] != 0x49 || buf[2] != 0x43 || buf[3] != 0x41) {
        throw new RangeError("Bad magic in octet stream");
    }
    else {
        switch (buf[4]) {
            case 0x01:
                return decodeOctetsV1(buf);
            default:
                throw new RangeError(`Unknown octet stream version: ${buf[4]}`);
        }
    }
}

function decodeOctetsV1(buf: Uint8Array): Uint8Array {
    switch (buf[5]) {
        case 0x00: // No compression
            return buf.slice(6);
        default:
            throw new RangeError(`Unknown compression scheme: ${buf[5]}`);
    }
}
