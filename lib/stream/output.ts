import { Buffer } from "./buffer.js";

export abstract class OutputStream<OutputT, InputT> {
    #onYield?: (input: InputT) => void;

    /** Write some data to the stream. The stream takes the ownership of
     * the data. Do not mutate it afterwards. */
    public abstract unsafeWrite(data: Buffer|Uint8Array): Generator<OutputT, void, InputT>;

    /** Write an unsigned 8-bit integer to the stream. */
    public abstract writeUint8(n: number): Generator<OutputT, void, InputT>;

    /** Write an unsigned 16-bit integer to the stream. */
    public abstract writeUint16(n: number, littleEndian?: boolean): Generator<OutputT, void, InputT>;

    /** Write an unsigned 32-bit integer to the stream. */
    public abstract writeUint32(n: number, littleEndian?: boolean): Generator<OutputT, void, InputT>;

    /** Called when the control is about to be suspended outside of the
     * methods in this stream. The value returned by this method will be
     * passed to the `yield` operator.
     */
    public abstract takeData(): OutputT;

    /** Set a callback function to be called when the stream is about to
     * suspend for producing data. The value returned by the `yield`
     * operator will be passed to the callback.
     */
    public onYield(cb: (input: InputT) => void): void {
        this.#onYield = cb;
    }

    /** Call this method to produce some output.
     */
     *flush(output: OutputT): Generator<OutputT, void, InputT> {
        if (this.#onYield) {
            this.#onYield(yield output);
        }
        else {
            throw new TypeError("onYield callback has not been set");
        }
    }
}

/** An in-memory output stream that writes data to a {@link Buffer}. This
 * stream never yields and thus the `onYield` callback will never be
 * called.
 */
export class BufferOutputStream<InputT> extends OutputStream<void, InputT> {
    /** This is the buffer that data will be written to. */
    readonly data: Buffer;

    public constructor() {
        super();
        this.data = new Buffer();
    }

    public *unsafeWrite(data: Buffer|Uint8Array): Generator<void, void, InputT> {
        // We are probably going to do a lot of small writes. Allocate some
        // extra space.
        if (data instanceof Buffer) {
            this.data.reserve(data.length);
        }
        else {
            this.data.reserve(data.byteLength);
        }
        this.data.unsafeAppend(data);
    }

    public *writeUint8(n: number): Generator<void, void, InputT> {
        this.data.appendUint8(n);
    }

    public *writeUint16(n: number, littleEndian = false): Generator<void, void, InputT> {
        this.data.appendUint16(n, littleEndian);
    }

    public *writeUint32(n: number, littleEndian = false): Generator<void, void, InputT> {
        this.data.appendUint32(n, littleEndian);
    }

    public takeData(): void {
        // Nothing to produce.
    }
}

/** An output stream that pushes data to the `yield` operator. The data is
 * internally buffered in the stream.
 */
export class PushOutputStream<InputT> extends OutputStream<Uint8Array, InputT> {
    readonly #buf: Buffer;
    readonly #bufSize: number;

    /** @param bufSize The number of octets to store in the buffer before
     * yielding. 0 means no data will ever be buffered.
     */
    public constructor(bufSize: number) {
        super();
        this.#buf     = new Buffer();
        this.#bufSize = bufSize;

        this.#buf.reserve(bufSize);
    }

    *#maybeFlush(): Generator<Uint8Array, void, InputT> {
        if (this.#buf.length >= this.#bufSize) {
            this.flush(this.#buf.toUint8Array());
            this.#buf.clear();
        }
    }

    public *unsafeWrite(data: Buffer|Uint8Array): Generator<Uint8Array, void, InputT> {
        this.#buf.unsafeAppend(data);
        yield* this.#maybeFlush();
    }

    public *writeUint8(n: number): Generator<Uint8Array, void, InputT> {
        this.#buf.appendUint8(n);
        yield* this.#maybeFlush();
    }

    public *writeUint16(n: number, littleEndian = false): Generator<Uint8Array, void, InputT> {
        this.#buf.appendUint16(n, littleEndian);
        yield* this.#maybeFlush();
    }

    public *writeUint32(n: number, littleEndian = false): Generator<Uint8Array, void, InputT> {
        this.#buf.appendUint32(n, littleEndian);
        yield* this.#maybeFlush();
    }

    public takeData(): Uint8Array {
        try {
            return this.#buf.toUint8Array();
        }
        finally {
            this.#buf.clear();
        }
    }
}
