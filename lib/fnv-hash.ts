import { Buffer } from "./buffer.js";
import { umul32 } from "./imath.js";

const FNV32_OFFSET_BASIS = 0x811c9dc5;
const FNV32_PRIME        = 0x01000193;

/** An implementation of 32-bit FNV-1a hash */
export class FNV1a32 {
    #acc: number;

    public constructor() {
        this.#acc = FNV32_OFFSET_BASIS;
    }

    /// Reset the hasher to its initial state.
    public reset(): void {
        this.#acc = FNV32_OFFSET_BASIS;
    }

    /// Feed the next octet for digestion.
    public update(octet: number): void;

    /// Feed the next chunk of octets for digestion.
    public update(octets: Buffer|Uint8Array): void;

    public update(arg: any): void {
        if (typeof arg === "number") {
            this.#acc ^= arg & 0xFF;
            this.#acc  = umul32(this.#acc, FNV32_PRIME);
        }
        else if (arg instanceof Buffer) {
            for (const chunk of arg.unsafeChunks()) {
                this.#updateWithChunk(chunk);
            }
        }
        else {
            this.#updateWithChunk(arg);
        }
    }

    #updateWithChunk(octets: Uint8Array): void {
        for (let i = 0; i < octets.byteLength; i++) {
            this.#acc ^= octets[i]!;
            this.#acc  = umul32(this.#acc, FNV32_PRIME);
        }
    }

    /// Produce the final digest.
    public final(): number {
        return this.#acc;
    }
}
