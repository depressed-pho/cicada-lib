import { Chunk } from "./buffer/chunk.js";

// IMPLEMENTATION NOTE: Never ever allocate chunks that are smaller than
// MIN_GROWTH. It induces a SEVERE performance issue.
const MIN_GROWTH    = 64;
const GROWTH_FACTOR = 0.5;

/** `Buffer` is a mutable, resizable sequence of octets. This is not a
 * Node.js Buffer. */
export class Buffer {
    #chunks: Chunk[];
    #length: number;

    /** Construct an empty `Buffer` object. If an argument `octets` is
     * provided, it will be stored in the buffer using {@link append}.
     */
    public constructor(octets?: Buffer|Uint8Array) {
        this.#chunks = [];
        this.#length = 0;

        if (octets) {
            this.append(octets);
        }
    }

    public get length(): number {
        return this.#length;
    }

    /** Allocate some extra space of at least `length` octets in the buffer
     * if it doesn't already have one.
     */
    public reserve(length: number): void {
        this.#reserve(length);
    }

    #growth(length: number): number {
        return Math.max(length, MIN_GROWTH, Math.trunc(this.length * GROWTH_FACTOR));
    }

    // Allocate some extra space of at least `length` octets in the buffer
    // if it doesn't already have one, and returns the chunk to write
    // data. The chunk is guaranteed to have unused space of at least the
    // given length.
    #reserve(length: number): Chunk {
        if (this.#chunks.length == 0) {
            // We don't even have any chunks yet.
            this.#chunks.push(Chunk.allocate(this.#growth(length)));
            return this.#chunks[0]!;
        }

        // Find the last non-empty chunk, because skipping empty chunks
        // wastes space.
        let i = this.#chunks.length - 1;
        for (; i >= 0; i--) {
            if (this.#chunks[i]!.length > 0) {
                break;
            }
        }

        if (i < 0) {
            // No non-empty chunks were found. Check the first one.
            i = 0;
        }

        if (this.#chunks[i]!.unused >= length) {
            // The last non-empty chunk has the requested space.
            return this.#chunks[i]!;
        }
        else {
            // The last non-empty chunk doesn't have the requested space so
            // we give up on it and try to find a chunk that has
            // space. This is going to waste some space but speed is more
            // important than that.
            for (; i < this.#chunks.length; i++) {
                if (this.#chunks[i]!.unused >= length)
                    // This chunk has enough unused space, and subsequent
                    // chunks are all empty. We can write some data on it.
                    return this.#chunks[i]!;
            }

            // Couldn't find a chunk to write. Allocate new one.
            this.#chunks.push(Chunk.allocate(this.#growth(length)));
            return this.#chunks[this.#chunks.length - 1]!;
        }
    }

    /** Create a contiguous Uint8Array out of buffer. Generally not
     * recommended. Use {@link unsafeChunks} whenever possible.
     */
    public toUint8Array(): Uint8Array {
        const buf = new Uint8Array(this.#length);
        let offset = 0;
        for (const bin of this.unsafeChunks()) {
            buf.set(bin, offset);
            offset += bin.byteLength;
        }
        return buf;
    }

    /** Iterate over chunks in the buffer. They are only valid until the
     * next time the buffer is mutated. The caller must not mutate
     * chunks.
     */
    public *unsafeChunks(): IterableIterator<Uint8Array> {
        for (const chunk of this.#chunks)
            yield chunk.toUint8Array();
    }

    /** Iterate over octets in the buffer. The iterator is only valid until
     * the next time the buffer is mutated.
     */
    public *[Symbol.iterator](): IterableIterator<number> {
        for (const chunk of this.#chunks)
            yield* chunk;
    }

    /** Clear data in the buffer but don't deallocate anything. Memory used
     * prior to calling `clear()` will still be reserved after the call.
     */
    public clear(): void {
        for (const chunk of this.#chunks) {
            chunk.clear();
        }
        this.#length = 0;
    }

    /** Append some data at the end of the buffer.
     */
    public append(octets: Buffer|Uint8Array): void {
        if (octets instanceof Buffer) {
            for (const chunk of octets.unsafeChunks()) {
                this.append(chunk);
            }
            return;
        }

        const chunk = this.#reserve(octets.byteLength);
        chunk.append(octets);
        this.#length += octets.byteLength;
    }

    /** Take the first `length` octets of the buffer. The returned buffer
     * is no longer owned by the original one and the caller is free to
     * mutate it.
     */
    public take(length: number): Buffer {
        const ret = new Buffer();

        if (length >= this.#length) {
            // Everything must go.
            ret.#chunks = this.#chunks;
            ret.#length = this.#length;

            this.#chunks = [];
            this.#length = 0;
        }
        else {
            while (ret.#length < length && this.#chunks.length > 0) {
                const firstChunk = this.#chunks[0]!;

                if (firstChunk.length <= length) {
                    // Move this entire chunk.
                    ret.#chunks.push(this.#chunks.shift()!);
                    ret.#length  += firstChunk.length;
                    this.#length -= firstChunk.length;
                }
                else {
                    // Split the chunk.
                    const taken = firstChunk.take(length);
                    ret.#chunks.push(taken);
                    ret.#length  += length;
                    this.#length -= length;
                    break;
                }
            }
        }

        return ret;
    }

    /** Delete the first `length` octets of the buffer.
     */
    public drop(length: number): void {
        if (length <= 0) {
            // No need to do anything.
        }
        else if (length >= this.#length) {
            // Everything must go.
            this.clear();
        }
        else {
            while (length > 0 && this.#chunks.length > 0) {
                const firstChunk = this.#chunks[0]!;

                if (firstChunk.length <= length) {
                    // Drop this entire chunk.
                    this.#chunks.shift();
                    this.#length -= firstChunk.length;
                    length       -= firstChunk.length;
                }
                else {
                    // Discard some part of the chunk.
                    firstChunk.drop(length);
                    this.#length -= length;
                    break;
                }
            }
        }
    }

    /** Create a new `Buffer` without copying underlying memory. The
     * returned buffer will only be valid until the next time the original
     * buffer is mutated. Do not mutate the returned buffer.
     */
    public unsafeSubBuffer(begin?: number, end?: number): Buffer {
        begin ??= 0;
        if (begin < 0) {
            begin = Math.max(0, begin + this.#length);
        }

        end ??= this.#length;
        if (end < 0) {
            end = Math.max(0, end + this.#length);
        }

        const ret = new Buffer();
        let offset = begin;
        let length = end - begin;
        for (const chunk of this.#chunks) {
            if (length <= 0) {
                break;
            }
            else if (chunk.length <= offset) {
                // Skip this chunk entirely.
                offset -= chunk.length;
            }
            else if (chunk.length <= length) {
                // The requested range covers this entire chunk.
                ret.#chunks.push(chunk);
                ret.#length += chunk.length;
                offset      -= chunk.length;
                length      -= chunk.length;
            }
            else {
                // The requested range covers a part of this chunk.
                const subChunk = chunk.unsafeSubChunk(offset, offset + length);
                ret.#chunks.push(subChunk);
                ret.#length += subChunk.length;
                offset      -= subChunk.length;
                end         -= subChunk.length;
            }
        }
        return ret;
    }

    public getUint8(offset: number): number {
        for (const chunk of this.#chunks) {
            if (chunk.length >= offset + 1) {
                return chunk.u8View[offset]!;
            }
            else {
                offset -= chunk.length;
            }
        }
        throw new RangeError(`Offset out of range: offset ${offset}, length ${this.#length}`);
    }

    public setUint8(offset: number, n: number): void {
        for (const chunk of this.#chunks) {
            if (chunk.length >= offset + 1) {
                chunk.u8View[offset] = n;
                return;
            }
            else {
                offset -= chunk.length;
            }
        }
        throw new RangeError(`Offset out of range: offset ${offset}, length ${this.#length}`);
    }

    public appendUint8(n: number): void {
        const chunk = this.#reserve(1);
        chunk.dView.setUint8(chunk.length, n);
        chunk.length++;
        this.#length++;
    }

    public getUint16(offset: number, littleEndian = false): number {
        for (const chunk of this.#chunks) {
            if (chunk.length >= offset + 2) {
                // Sweet. We can read it from a contiguous buffer.
                return chunk.dView.getUint16(offset, littleEndian);
            }
            else if (chunk.length <= offset) {
                // We can skip this entire chunk.
                offset -= chunk.length;
            }
            else {
                // Damn, we must do a partial read.
                if (littleEndian) {
                    let n = this.getUint8(offset  );
                    n    |= this.getUint8(offset+1) <<  8;
                    return n >>> 0;
                }
                else {
                    let n = this.getUint8(offset  ) << 8;
                    n    |= this.getUint8(offset+1);
                    return n >>> 0;
                }
            }
        }
        throw new RangeError(`Offset out of range: offset ${offset}, length ${this.#length}`);
    }

    public setUint16(offset: number, n: number, littleEndian = false): void {
        for (const chunk of this.#chunks) {
            if (chunk.length >= offset + 2) {
                // Sweet. We can write it to a contiguous buffer.
                chunk.dView.setUint16(offset, n, littleEndian);
                return;
            }
            else if (chunk.length <= offset) {
                // We can skip this entire chunk.
                offset -= chunk.length;
            }
            else {
                // Damn, we must do a partial write.
                if (littleEndian) {
                    this.setUint8(offset  ,  n        & 0xFF);
                    this.setUint8(offset+1, (n >>> 8) & 0xFF);
                }
                else {
                    this.setUint8(offset  , (n >>> 8) & 0xFF);
                    this.setUint8(offset+1,  n        & 0xFF);
                }
                return;
            }
        }
        throw new RangeError(`Offset out of range: offset ${offset}, length ${this.#length}`);
    }

    public appendUint16(n: number, littleEndian = false): void {
        const chunk = this.#reserve(2);
        chunk.dView.setUint16(chunk.length, n, littleEndian);
        chunk.length += 2;
        this.#length += 2;
    }

    public getUint32(offset: number, littleEndian = false): number {
        for (const chunk of this.#chunks) {
            if (chunk.length >= offset + 4) {
                // Sweet. We can read it from a contiguous buffer.
                return chunk.dView.getUint32(offset, littleEndian);
            }
            else if (chunk.length <= offset) {
                // We can skip this entire chunk.
                offset -= chunk.length;
            }
            else {
                // Damn, we must do a partial read.
                if (littleEndian) {
                    let n = this.getUint8(offset  );
                    n    |= this.getUint8(offset+1) <<  8;
                    n    |= this.getUint8(offset+2) << 16;
                    n    |= this.getUint8(offset+3) << 24;
                    return n >>> 0;
                }
                else {
                    let n = this.getUint8(offset  ) << 24;
                    n    |= this.getUint8(offset+1) << 16;
                    n    |= this.getUint8(offset+2) <<  8;
                    n    |= this.getUint8(offset+3);
                    return n >>> 0;
                }
            }
        }
        throw new RangeError(`Offset out of range: offset ${offset}, length ${this.#length}`);
    }

    public setUint32(offset: number, n: number, littleEndian = false): void {
        for (const chunk of this.#chunks) {
            if (chunk.length >= offset + 4) {
                // Sweet. We can write it to a contiguous buffer.
                chunk.dView.setUint32(offset, n, littleEndian);
                return;
            }
            else if (chunk.length <= offset) {
                // We can skip this entire chunk.
                offset -= chunk.length;
            }
            else {
                // Damn, we must do a partial read.
                if (littleEndian) {
                    this.setUint16(offset  ,  n         & 0xFFFF);
                    this.setUint16(offset+2, (n >>> 16) & 0xFFFF);
                }
                else {
                    this.setUint16(offset  , (n >>> 16) & 0xFFFF);
                    this.setUint16(offset+2,  n         & 0xFFFF);
                }
                return;
            }
        }
        throw new RangeError(`Offset out of range: offset ${offset}, length ${this.#length}`);
    }

    public appendUint32(n: number, littleEndian = false): void {
        const chunk = this.#reserve(4);
        chunk.dView.setUint32(chunk.length, n, littleEndian);
        chunk.length += 4;
        this.#length += 4;
    }

    public appendFloat64(n: number, littleEndian = false): void {
        const chunk = this.#reserve(8);
        chunk.dView.setFloat64(chunk.length, n, littleEndian);
        chunk.length += 8;
        this.#length += 8;
    }

    /// @internal: We do a lot of debugging by running these classes on
    /// Node.js.
    [Symbol.for("nodejs.util.inspect.custom")](_depth: number, _opts: any, inspect: any) {
        const str = inspect(this.toUint8Array());
        return `Buffer${str.slice("Uint8Array".length)}`;
    }
}
