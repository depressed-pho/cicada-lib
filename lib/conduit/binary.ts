import { Buffer } from "../buffer.js";
import { Conduit, PrematureEOF, awaitC, conduit, headE, leftover, takeExactlyE,
         yieldC } from "../conduit.js";
import { lazy } from "../lazy.js";

export const readUint8: Conduit<Buffer, any, number> =
    lazy(() =>
        conduit(function* () {
            const o = yield* headE;
            if (o !== undefined)
                return o;
            else
                throw new PrematureEOF(
                    "Premature end of stream while reading an uint32 value");
        }));

export function readUint16(littleEndian = false): Conduit<Buffer, any, number> {
    return takeExactlyE(2, conduit(function* () {
        let n = 0;
        if (littleEndian) {
            for (let i = 0, shift = 0; i < 2; ) {
                const chunk = yield* awaitC;
                if (chunk) {
                    for (const o of chunk) {
                        n |= (o & 0xFF) << shift;
                        i++;
                        shift += 8;
                    }
                }
                else {
                    throw new PrematureEOF(
                        "Premature end of stream while reading an uint16 value");
                }
            }
        }
        else {
            for (let i = 0; i < 2; ) {
                const chunk = yield* awaitC;
                if (chunk) {
                    for (const o of chunk) {
                        n <<= 8;
                        n |= o & 0xFF;
                    }
                }
                else {
                    throw new PrematureEOF(
                        "Premature end of stream while reading an uint16 value");
                }
            }
        }
        return n >>> 0;
    }));
}

export function readUint32(littleEndian = false): Conduit<Buffer, any, number> {
    return takeExactlyE(4, conduit(function* () {
        let n = 0;
        if (littleEndian) {
            for (let i = 0, shift = 0; i < 4; ) {
                const chunk = yield* awaitC;
                if (chunk) {
                    for (const o of chunk) {
                        n |= (o & 0xFF) << shift;
                        i++;
                        shift += 8;
                    }
                }
                else {
                    throw new PrematureEOF(
                        "Premature end of stream while reading an uint32 value");
                }
            }
        }
        else {
            for (let i = 0; i < 4; ) {
                const chunk = yield* awaitC;
                if (chunk) {
                    for (const o of chunk) {
                        n <<= 8;
                        n |= o & 0xFF;
                    }
                }
                else {
                    throw new PrematureEOF(
                        "Premature end of stream while reading an uint16 value");
                }
            }
        }
        return n >>> 0;
    }));
}

export function writeUint32(n: number, littleEndian = false): Conduit<unknown, Buffer, void> {
    return conduit(function* () {
        const buf = new Buffer();
        buf.appendUint32(n, littleEndian);
        yield* yieldC(buf);
    });
}

/** Take at most the given number of octets from a `Buffer` conduit. It
 * won't raise an error if the conduit reaches EOF before consuming the
 * exact number of octets.
 */
export function takeOctets(len: number): Conduit<Buffer, any, Uint8Array> {
    return conduit(function* () {
        const buf = new Buffer();
        for (let rem = len; rem > 0; ) {
            const chunk = yield* awaitC;
            if (chunk) {
                const l = chunk.length;
                if (l - rem > 0) {
                    buf.append(chunk.unsafeSubBuffer(0, rem));
                    yield* leftover(chunk.unsafeSubBuffer(rem));
                }
                else {
                    buf.append(chunk);
                }
                rem -= l;
            }
            else {
                break;
            }
        }
        return buf.toUint8Array();
    });
}
