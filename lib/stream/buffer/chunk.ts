/** For internal use only */
export class Chunk {
    readonly #buffer: ArrayBufferLike;
    #offset:   number;
    #length:   number;
    #capacity: number;

    // These are invalidated when the chunk is resized.
    #dView:  DataView|null;
    #u8View: Uint8Array|null;

    public static allocate(length: number): Chunk {
        return new Chunk(new ArrayBuffer(length), 0, 0);
    }

    public static wrap(octets: Uint8Array): Chunk {
        return new Chunk(octets.buffer, octets.byteOffset, octets.byteLength, octets.byteLength);
    }

    protected constructor(buffer: ArrayBufferLike,
                          offset   = 0,
                          length   = buffer.byteLength - offset,
                          capacity = buffer.byteLength - offset) {
        this.#buffer   = buffer;
        this.#offset   = offset;
        this.#length   = length;
        this.#capacity = capacity;
        this.#dView    = null;
        this.#u8View   = null;
    }

    public get length(): number {
        return this.#length;
    }

    public set length(len: number) {
        if (len >= 0 && len <= this.#capacity) {
            if (this.#length != len) {
                this.#length = len;
                this.#invalidateViews();
            }
        }
        else {
            throw new RangeError(`New length ${len} is out of range`);
        }
    }

    public get unused(): number {
        return this.#capacity - this.#length;
    }

    public get dView(): DataView {
        if (!this.#dView) {
            this.#dView = new DataView(this.#buffer, this.#offset, this.#capacity);
        }
        return this.#dView;
    }

    public get u8View(): Uint8Array {
        if (!this.#u8View) {
            this.#u8View = new Uint8Array(this.#buffer, this.#offset, this.#capacity);
        }
        return this.#u8View;
    }

    public toUint8Array(): Uint8Array {
        if (this.#u8View && this.#capacity == this.#length) {
            return this.#u8View;
        }
        else {
            return new Uint8Array(this.#buffer, this.#offset, this.#length);
        }
    }

    public unsafeSubarray(begin?: number, end?: number): Chunk {
        begin ??= 0;
        if (begin < 0) {
            begin += this.#length;
        }
        if (begin > this.#length) {
            begin = this.#length;
        }

        end ??= this.#length;
        if (end < 0) {
            end += this.#length;
        }
        if (end > this.#length) {
            end = this.#length;
        }

        const actualLen = end - begin;
        return new Chunk(this.#buffer, this.#offset + begin, actualLen, actualLen);
    }

    #invalidateViews(): void {
        this.#dView  = null;
        this.#u8View = null;
    }

    public clear(): void {
        this.#length = 0;
        this.#invalidateViews();
    }

    public append(octets: Uint8Array): void {
        this.u8View.set(octets, this.#length);
        this.#length += octets.byteLength;
        this.#invalidateViews();
    }

    public take(length: number): Chunk {
        const actualLen = Math.min(length, this.#length);
        const taken     = new Chunk(this.#buffer, this.#offset, actualLen, actualLen);

        this.#offset   += actualLen;
        this.#capacity -= actualLen;
        this.#length   -= actualLen;

        this.#invalidateViews();
        return taken;
    }

    public drop(length: number): void {
        const actualLen = Math.min(length, this.#length);

        this.#offset   += actualLen;
        this.#capacity -= actualLen;
        this.#length   -= actualLen;

        this.#invalidateViews();
    }
}
