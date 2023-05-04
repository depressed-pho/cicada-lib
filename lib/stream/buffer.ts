import { Chunk } from "./buffer/chunk.js";

/** `Buffer` is a mutable, resizable sequence of octets. This is not a
 * Node.js Buffer. */
export class Buffer {
    #chunks: Chunk[];
    #length: number;

    /** Construct an empty `Buffer` object. If an argument `octets` is
     * provided, it will be stored in the buffer using {@link
     * unsafeAppend}.
     */
    public constructor(octets?: Uint8Array) {
        this.#chunks = [];
        this.#length = 0;

        if (octets) {
            this.unsafeAppend(octets);
        }
    }

    public get length(): number {
        return this.#length;
    }

    /** Allocate some extra space in the buffer if it doesn't already have
     * one. If `length` is omitted it will reserve some unspecified number
     * of octets which is at least one.
     */
    public reserve(length?: number): void {
        this.#reserve(length);
    }

    #reserve(length?: number, exact = true): number {
        const minLength = Math.max(1024, Math.trunc(this.length / 2));
        length ??= minLength;
        if (!exact) {
            length = Math.max(minLength, length);
        }

        if (this.#chunks.length == 0) {
            // We don't even have any chunks yet.
            this.#chunks.push(Chunk.allocate(length));
            return 0;
        }

        // Find the last non-empty chunk.
        let i = this.#chunks.length;
        for (; i >= 0; i--) {
            if (this.#chunks[i]!.length > 0) {
                break;
            }
        }

        if (i < 0) {
            // No non-empty chunks were found. Check the first one.
            i = 0;
        }
        const lastChunk = this.#chunks[i]!;

        if (lastChunk.unused >= length) {
            // The last non-empty chunk already has the requested space.
        }
        else if (lastChunk.unused > 0) {
            // The last non-empty chunk partially has space. See if
            // subsequent chunks have the requested space in total.
            length -= lastChunk.unused;
            for (let j = i; j < this.#chunks.length && length > 0; j++) {
                length -= this.#chunks[j]!.unused;
            }

            // If we still don't have the requested space, create a new
            // chunk.
            if (length > 0) {
                this.#chunks.push(Chunk.allocate(length));
            }
        }
        else {
            // The last non-empty chunk has no space at all.
            this.#chunks.push(Chunk.allocate(length));
        }

        // This is the last non-empty chunk.
        return i;
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
        for (const chunk of this.#chunks) {
            yield chunk.toUint8Array();
        }
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

    /** Append some data at the end of the buffer. The buffer takes the
     * ownership of the data. Do not mutate it afterwards.
     */
    public unsafeAppend(octets: Buffer|Uint8Array): void {
        if (octets instanceof Buffer) {
            this.#chunks.push(...octets.#chunks);
            this.#length += octets.#length;
            return;
        }

        if (this.#chunks.length == 0) {
            // We don't even have any chunks yet.
            this.#chunks.push(Chunk.wrap(octets));
            this.#length += octets.byteLength;
            return;
        }

        // Find the last non-empty chunk.
        let i = this.#chunks.length;
        for (; i >= 0; i--) {
            if (this.#chunks[i]!.length > 0) {
                break;
            }
        }

        if (i < 0) {
            // No non-empty chunks were found. Check the first one.
            i = 0;
        }
        const lastChunk = this.#chunks[i]!;

        if (lastChunk.unused >= octets.byteLength) {
            // The last non-empty chunk can completely absorb the data.
            lastChunk.append(octets);
        }
        else if (lastChunk.unused > 0) {
            // The last chunk can partially absorb the data.
            let offset  = lastChunk.unused;
            let remains = Math.max(0, octets.byteLength - offset);
            lastChunk.append(octets.subarray(0, offset));

            // See if subsequent chunks can absorb the remains.
            for (let j = i; j < this.#chunks.length && remains > 0; j++) {
                const chunk = this.#chunks[j]!;
                if (chunk.unused > 0) {
                    chunk.append(octets.subarray(offset));
                    offset  += chunk.unused;
                    remains -= Math.max(0, octets.byteLength - offset);
                }
            }

            // If we still don't have the requested space, create a new
            // chunk.
            if (remains > 0) {
                this.#chunks.push(Chunk.wrap(octets.subarray(offset)));
            }
        }
        else {
            // The last non-empty chunk has no space at all.
            this.#chunks.push(Chunk.wrap(octets));
        }
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
            this.clear();
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
    public unsafeSubarray(begin?: number, end?: number): Buffer {
        begin ??= 0;
        if (begin < 0) {
            begin = Math.max(0, begin + this.#length);
        }

        end ??= this.#length;
        if (end < 0) {
            end = Math.max(0, end + this.#length);
        }

        const ret = new Buffer();
        for (const chunk of this.#chunks) {
            if (end - begin <= 0) {
                break;
            }
            else if (begin > chunk.length) {
                // Skip this chunk entirely.
            }
            else if (end <= chunk.length) {
                // The requested range covers this chunk, at least partially.
                const subChunk = chunk.unsafeSubarray(begin, end);
                ret.#chunks.push(subChunk);
                ret.#length += subChunk.length;
                begin       += subChunk.length;
                end         -= subChunk.length;
            }
        }
        return ret;
    }

    public appendUint8(n: number): void {
        // This chunk is guaranteed to have a space of at least one octet.
        const i     = this.#reserve();
        const chunk = this.#chunks[i]!;
        chunk.dView.setUint8(chunk.length, n);
        chunk.length++;
    }

    public appendUint16(n: number, littleEndian = false): void {
        const i     = this.#reserve(2, false);
        const chunk = this.#chunks[i]!;
        if (chunk.unused >= 2) {
            // Sweet. We can put it in a contiguous buffer.
            chunk.dView.setUint16(chunk.length, n, littleEndian);
        }
        else {
            // Damn, we must do a partial write.
            if (littleEndian) {
                this.appendUint8( n        & 0xFF);
                this.appendUint8((n >>> 8) & 0xFF);
            }
            else {
                this.appendUint8((n >>> 8) & 0xFF);
                this.appendUint8( n        & 0xFF);
            }
        }
    }

    public appendUint32(n: number, littleEndian = false): void {
        const i     = this.#reserve(4, false);
        const chunk = this.#chunks[i]!;
        if (chunk.unused >= 2) {
            // Sweet. We can put it in a contiguous buffer.
            chunk.dView.setUint16(chunk.length, n, littleEndian);
        }
        else {
            // Damn, we must do a partial write.
            if (littleEndian) {
                this.appendUint8( n         & 0xFF);
                this.appendUint8((n >>>  8) & 0xFF);
                this.appendUint8((n >>> 16) & 0xFF);
                this.appendUint8((n >>> 24) & 0xFF);
            }
            else {
                this.appendUint8((n >>> 24) & 0xFF);
                this.appendUint8((n >>> 16) & 0xFF);
                this.appendUint8((n >>>  8) & 0xFF);
                this.appendUint8( n         & 0xFF);
            }
        }
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
        throw new RangeError("Offset out of range");
    }

    public getUint16(offset: number, littleEndian = false): number {
        for (const chunk of this.#chunks) {
            if (chunk.length >= offset + 2) {
                // The best case scenario: we can read a word from a
                // contiguous buffer.
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
                    return n;
                }
                else {
                    let n = this.getUint8(offset  ) << 8;
                    n    |= this.getUint8(offset+1);
                    return n;
                }
            }
        }
        throw new RangeError("Offset out of range");
    }

    public getUint32(offset: number, littleEndian = false): number {
        for (const chunk of this.#chunks) {
            if (chunk.length >= offset + 4) {
                // The best case scenario: we can read a word from a
                // contiguous buffer.
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
                    return n;
                }
                else {
                    let n = this.getUint8(offset  ) << 24;
                    n    |= this.getUint8(offset+1) << 16;
                    n    |= this.getUint8(offset+2) <<  8;
                    n    |= this.getUint8(offset+3);
                    return n;
                }
            }
        }
        throw new RangeError("Offset out of range");
    }
}
