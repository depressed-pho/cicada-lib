/** Package private */
export interface IEventSignal<T> {
    subscribe(cb: (ev: T) => void): (ev: T) => void;
    unsubscribe(cb: (ev: T) => void): void;
}

/** Package private */
export class CustomEventSignal<T> implements IEventSignal<T> {
    readonly #handlers: Set<(ev: T) => void>;

    constructor() {
        this.#handlers = new Set();
    }

    public subscribe(cb: (ev: T) => void): (ev: T) => void {
        this.#handlers.add(cb);
        return cb;
    }

    public unsubscribe(cb: (ev: T) => void): void {
        this.#handlers.delete(cb);
    }

    public signal(ev: T): void {
        for (const cb of this.#handlers) {
            /* QuickJS, the current interpreter used by Minecraft BE,
             * doesn't provide a mechanism to catch unhandled rejection of
             * promises. But it's common that the listener is actually an
             * async function and it doesn't catch exceptions. When that
             * happens exceptions get lost and cause a great confusion, so
             * if the function returns a promise attach a handler to catch
             * them all. */
            const ret = cb(ev);
            Promise.resolve(ret).catch(e => console.error(e));
        }
    }
}

/** Package private */
export class GluedEventSignal<T, RawT = any> implements IEventSignal<T> {
    readonly #signal:   IEventSignal<RawT>;
    readonly #glue:     (rawEv: RawT) => T;
    readonly #handlers: Map<(ev: T) => void, (rawEv: RawT) => void>;

    constructor(rawSignal: IEventSignal<RawT>, glue: (rawEv: RawT) => T) {
        this.#signal   = rawSignal;
        this.#glue     = glue;
        this.#handlers = new Map();
    }

    public subscribe(cb: (ev: T) => void): (ev: T) => void {
        const handler = (rawEv: RawT) => {
            /* QuickJS, the current interpreter used by Minecraft BE,
             * doesn't provide a mechanism to catch unhandled rejection of
             * promises. But it's common that the listener is actually an
             * async function and it doesn't catch exceptions. When that
             * happens exceptions get lost and cause a great confusion, so
             * if the function returns a promise attach a handler to catch
             * them all. */
            const ret = cb(this.#glue(rawEv));
            Promise.resolve(ret).catch(e => console.error(e));
        };

        this.#signal.subscribe(handler);
        this.#handlers.set(cb, handler);
        return cb;
    }

    public unsubscribe(cb: (ev: T) => void): void {
        const handler = this.#handlers.get(cb);
        if (handler) {
            this.#signal.unsubscribe(handler);
            this.#handlers.delete(cb);
        }
    }
}

/** Package private: The sole reason this class exists is that we want to
 * catch unhandled rejection of promises. */
export class PassThruEventSignal<T> implements IEventSignal<T> {
    readonly #glued: GluedEventSignal<T, T>;

    constructor(rawSignal: IEventSignal<T>) {
        this.#glued = new GluedEventSignal(rawSignal, (ev) => ev);
    }

    public subscribe(cb: (ev: T) => void): (ev: T) => void {
        this.#glued.subscribe(cb);
        return cb;
    }

    public unsubscribe(cb: (ev: T) => void): void {
        this.#glued.unsubscribe(cb);
    }
}
