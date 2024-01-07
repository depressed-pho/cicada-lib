import { Buffer } from "./buffer.js";

export class PrematureEOF extends Error {
    public constructor(...args: ConstructorParameters<typeof Error>) {
        super(...args);
    }
}

export abstract class InputStream<OutputT, InputT> {
    #onYield?: () => OutputT;

    /** Return `true` if the stream is closed. Otherwise `false`.
     */
    public abstract isEOF(): Generator<OutputT, boolean, InputT>;

    /** Get an input of the given length without consuming it. The returned
     * `Buffer` shall contain *at least* the requested amount of data, and
     * will only be valid until the next time any of the methods of the
     * stream is called. Do not mutate the returned buffer.
     */
    public abstract unsafePeek(length: number): Generator<OutputT, Buffer, InputT>;

    /** Consume an input of the given length. The returned `Buffer` shall
     * contain the *exact* amount of data requested. The caller is free to
     * mutate the returned buffer.
     */
    public abstract read(length: number): Generator<OutputT, Buffer, InputT>;

    /** Consume some input of at most the given length. The returned buffer
     * will contain less number of octets when there isn't enough data
     * readily available. The caller is free to mutate the returned buffer.
     */
    public abstract readSome(length: number): Generator<OutputT, Buffer|undefined, InputT>;

    /** Discard an input of the given length. */
    public abstract skip(length: number): Generator<OutputT, void, InputT>;

    /** Called when the control was suspended outside of the methods in
     * this stream and was resumed with some data. The stream does not take
     * the ownership of the data.
     */
    public abstract gotData(input?: InputT): void;

    /** Set a callback function to be called when the stream is about to
     * suspend for more data. The value returned by the callback will be
     * passed to the `yield` operator.
     */
    public onYield(cb: () => OutputT): void {
        this.#onYield = cb;
    }

    /** Call this method to wait for input.
     */
    protected *needMore(): Generator<OutputT, InputT, InputT> {
        if (this.#onYield) {
            return yield this.#onYield();
        }
        else {
            throw new TypeError("onYield callback has not been set");
        }
    }

    /** Get an unsigned 8-bits integer without consuming it. */
    public *peekUint8(): Generator<OutputT, number, InputT> {
        const buf = yield* this.unsafePeek(1);
        return buf.getUint8(0);
    }

    /** Get an unsigned 16-bits integer without consuming it. */
    public *peekUint16(littleEndian = false): Generator<OutputT, number, InputT> {
        const buf = yield* this.unsafePeek(2);
        return buf.getUint16(0, littleEndian);
    }

    /** Get an unsigned 32-bits integer without consuming it. */
    public *peekUint32(littleEndian = false): Generator<OutputT, number, InputT> {
        const buf = yield* this.unsafePeek(4);
        return buf.getUint32(0, littleEndian);
    }

    /** Consume an unsigned 8-bits integer. */
    public *readUint8(): Generator<OutputT, number, InputT> {
        const buf = yield* this.unsafePeek(1);
        try {
            return buf.getUint8(0);
        }
        finally {
            buf.drop(1);
        }
    }

    /** Consume an unsigned 16-bits integer. */
    public *readUint16(littleEndian = false): Generator<OutputT, number, InputT> {
        const buf = yield* this.unsafePeek(2);
        try {
            return buf.getUint16(0, littleEndian);
        }
        finally {
            buf.drop(2);
        }
    }

    /** Consume an unsigned 32-bits integer. */
    public *readUint32(littleEndian = false): Generator<OutputT, number, InputT> {
        const buf = yield* this.unsafePeek(4);
        try {
            return buf.getUint32(0, littleEndian);
        }
        finally {
            buf.drop(4);
        }
    }
}

/** An in-memory input stream that reads from a {@link Buffer} that is
 * given to its constructor. This stream never yields and thus the
 * `onYield` callback will never be called.
 */
export class BufferInputStream<OutputT> extends InputStream<OutputT, void> {
    readonly #buf: Buffer;

    public constructor(buf: Buffer) {
        super();
        this.#buf = buf;
    }

    public *isEOF(): Generator<OutputT, boolean, void> {
        return this.#buf.length <= 0;
    }

    public gotData(_input?: void): void {
        // Ignore the input.
    }

    public *unsafePeek(length: number): Generator<OutputT, Buffer, void> {
        if (this.#buf.length >= length) {
            return this.#buf;
        }
        else {
            throw new PrematureEOF(`Reached the end of buffer before peeking ${length} octets`);
        }
    }

    public *read(length: number): Generator<OutputT, Buffer, void> {
        yield* this.unsafePeek(length);
        return this.#buf.take(length);
    }

    public *readSome(length: number): Generator<OutputT, Buffer|undefined, void> {
        return this.#buf.length > 0
            ? this.#buf.take(length)
            : undefined;
    }

    public *skip(length: number): Generator<OutputT, void, void> {
        yield* this.unsafePeek(length);
        this.#buf.drop(length);
    }
}

/** An input stream that gets data from the `yield` operator. Calling
 * `Generator.prototype.next` without an argument signals an EOF. The data
 * is internally buffered in the stream, and its ownership is taken by the
 * stream. Do not mutate it afterwards.
 */
export class PushInputStream<OutputT> extends InputStream<OutputT, Uint8Array> {
    readonly #buf: Buffer;
    #isClosed: boolean;

    public constructor() {
        super();
        this.#buf      = new Buffer();
        this.#isClosed = false;
    }

    public *isEOF(): Generator<OutputT, boolean, Uint8Array> {
        if (this.#buf.length > 0) {
            return false;
        }
        else if (this.#isClosed) {
            return true;
        }
        else {
            const input = yield* this.needMore();
            this.gotData(input);
            if (input) {
                return false;
            }
            else {
                this.#isClosed = true;
                return true;
            }
        }
    }

    public gotData(input?: Uint8Array): void {
        if (input) {
            if (this.#isClosed) {
                throw new Error("Cannot push data after signaling EOF");
            }
            this.#buf.append(input);
        }
    }

    public *unsafePeek(length: number): Generator<OutputT, Buffer, Uint8Array> {
        while (true) {
            if (this.#buf.length >= length) {
                return this.#buf;
            }
            else {
                const input = yield* this.needMore();
                this.gotData(input);
                if (!input) {
                    throw new PrematureEOF(`Got an EOF before peeking ${length} octets`);
                }
            }
        }
    }

    public *read(length: number): Generator<OutputT, Buffer, Uint8Array> {
        yield* this.unsafePeek(length);
        return this.#buf.take(length);
    }

    public *readSome(length: number): Generator<OutputT, Buffer|undefined, Uint8Array> {
        if (this.#buf.length == 0) {
            this.gotData(yield* this.needMore());
        }
        return this.#buf.take(length);
    }

    public *skip(length: number): Generator<OutputT, void, Uint8Array> {
        yield* this.unsafePeek(length);
        this.#buf.drop(length);
    }
}
