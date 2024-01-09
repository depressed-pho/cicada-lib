import { Buffer } from "./stream.js";
import { umul32, urotl32 } from "./imath.js";

const PRIME32_1 = 0x9E3779B1;
const PRIME32_2 = 0x85EBCA77;
const PRIME32_3 = 0xC2B2AE3D;
const PRIME32_4 = 0x27D4EB2F;
const PRIME32_5 = 0x165667B1;

/** An implementation of 32-bit xxHash:
 * https://github.com/Cyan4973/xxHash/blob/release/doc/xxhash_spec.md */
export class XXH32 {
    readonly #seed: number;
    readonly #acc: Uint32Array; // 4 elements long.
    readonly #buf: Uint8Array;  // 16 octets long.
    #bufLen: number;
    #total: number;

    public constructor(seed = 0) {
        this.#seed   = seed;
        this.#acc    = new Uint32Array(4);
        this.#buf    = new Uint8Array(16);
        this.#bufLen = 0;
        this.#total  = 0;
        this.reset();
    }

    /// Reset the hasher to its initial state.
    public reset(): void {
        this.#acc[0] = this.#seed + PRIME32_1 + PRIME32_2;
        this.#acc[1] = this.#seed + PRIME32_2;
        this.#acc[2] = this.#seed;
        this.#acc[3] = this.#seed - PRIME32_1;
        this.#bufLen = 0;
        this.#total  = 0;
    }

    /// Feed the next chunk of octets for digestion.
    public update(octets: Buffer|Uint8Array): void {
        if (octets instanceof Buffer) {
            for (const chunk of octets.unsafeChunks()) {
                this.#update(chunk);
            }
        }
        else {
            this.#update(octets);
        }
    }

    #update(octets: Uint8Array): void {
        let offset = 0;
        if (this.#bufLen > 0 && this.#bufLen + octets.byteLength >= 16) {
            // We have a pending input, and concatenating it with the
            // incoming octets can form a stripe. Consume it.
            const chunk = octets.subarray(0, 16 - this.#bufLen);
            offset = chunk.byteLength;

            this.#buf.set(chunk, this.#bufLen);
            this.#consumeStripe(this.#buf, 0);
            this.#bufLen = 0;
        }

        for (; offset + 16 <= octets.byteLength; offset += 16) {
            // The input can still form a stripe. Consume it.
            this.#consumeStripe(octets, offset);
        }

        // No stripes anymore. Save the remaining octets as a pending
        // input.
        if (offset < octets.byteLength) {
            const chunk = octets.subarray(offset, octets.byteLength);
            this.#buf.set(chunk, this.#bufLen);
            this.#bufLen += chunk.byteLength;
        }
        this.#total += octets.byteLength;
    }

    #consumeStripe(stripe: Uint8Array, offset: number): void {
        for (let lane_i = 0, lane_off = offset; lane_i < 4; lane_i++, lane_off += 4) {
            const lane_lo = stripe[lane_off + 1]! << 8 | stripe[lane_off + 0]!;
            const lane_hi = stripe[lane_off + 3]! << 8 | stripe[lane_off + 2]!;
            const lane    = lane_hi << 16 | lane_lo;
            this.#acc[lane_i] =
                umul32(
                    urotl32(
                        umul32(lane, PRIME32_2) + this.#acc[lane_i]! | 0, 13), PRIME32_1);
        }
    }

    /// Produce the final digest.
    public final(): number {
        let acc: number;
        if (this.#total < 16) {
            acc = this.#seed + PRIME32_5;
        }
        else {
            acc =
                urotl32(this.#acc[0]!,  1) +
                urotl32(this.#acc[1]!,  7) +
                urotl32(this.#acc[2]!, 12) +
                urotl32(this.#acc[3]!, 18) >>> 0;
        }
        acc += this.#total & 0xFFFFFFFF;

        // Consume the remaining input.
        let lane_off = 0;
        for (; lane_off + 4 <= this.#bufLen; lane_off += 4) {
            const lane_lo = this.#buf[lane_off + 1]! << 8 | this.#buf[lane_off + 0]!;
            const lane_hi = this.#buf[lane_off + 3]! << 8 | this.#buf[lane_off + 2]!;
            const lane    = lane_hi << 16 | lane_lo;
            acc =
                umul32(
                    urotl32(
                        umul32(lane, PRIME32_3) + acc | 0, 17), PRIME32_4);
        }
        for (; lane_off < this.#bufLen; lane_off++) {
            const lane = this.#buf[lane_off]!;
            acc =
                umul32(
                    urotl32(
                        umul32(lane, PRIME32_5) + acc | 0, 11), PRIME32_1);
        }

        // Avalanche
        acc = umul32(acc ^ (acc >>> 15), PRIME32_2);
        acc = umul32(acc ^ (acc >>> 13), PRIME32_3);
        acc =        acc ^ (acc >>> 16);
        return acc >>> 0;
    }
}

/// One-shot XXH32.
export function xxHash32(octets: Uint8Array|Buffer, seed = 0): number {
    const h = new XXH32(seed);
    h.update(octets);
    return h.final();
}
