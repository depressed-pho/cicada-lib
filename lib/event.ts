/** Package private */
export type IEventSignal<Ev, Opts = void>
    = Opts extends void
    ? IEventSignalWithoutOptions<Ev>
    : IEventSignalWithOptions<Ev, Opts>;

interface IEventSignalWithoutOptions<Ev> {
    subscribe(cb: (ev: Ev) => void): (ev: Ev) => void;
    unsubscribe(cb: (ev: Ev) => void): void;
}

interface IEventSignalWithOptions<Ev, Opts> {
    subscribe(cb: (ev: Ev) => void, opts?: Opts): (ev: Ev) => void;
    unsubscribe(cb: (ev: Ev) => void): void;
}

/** Package private */
export class CustomEventSignal<Ev> implements IEventSignal<Ev> {
    readonly #handlers: Set<(ev: Ev) => void>;

    constructor() {
        this.#handlers = new Set();
    }

    public subscribe(cb: (ev: Ev) => void): (ev: Ev) => void {
        this.#handlers.add(cb);
        return cb;
    }

    public unsubscribe(cb: (ev: Ev) => void): void {
        this.#handlers.delete(cb);
    }

    public signal(ev: Ev): void {
        for (const cb of this.#handlers) {
            /* QuickJS, the current interpreter used by Minecraft BE,
             * doesn't provide a mechanism to catch unhandled rejection of
             * promises. But it's common that the listener is actually an
             * async function and it doesn't catch exceptions. When that
             * happens exceptions get lost and cause a great confusion, so
             * if the function returns a promise attach a handler to catch
             * them all.
             *
             * THINKME: We think we can now remove this as of v1.21.70.
             */
            const ret = cb(ev);
            Promise.resolve(ret).catch(e => console.error(e));
        }
    }
}

/** Package private */
export class GluedEventSignalWithoutOptions<Ev, RawEv> implements IEventSignalWithoutOptions<Ev> {
    readonly #signal:   IEventSignalWithoutOptions<RawEv>;
    readonly #glueEv:   (rawEv: RawEv) => Ev;
    readonly #handlers: Map<(ev: Ev) => void, (rawEv: RawEv) => void>;

    constructor(rawSignal: IEventSignalWithoutOptions<RawEv>, glueEv: (rawEv: RawEv) => Ev) {
        this.#signal   = rawSignal;
        this.#glueEv   = glueEv;
        this.#handlers = new Map();
    }

    public subscribe(cb: (ev: Ev) => void): (ev: Ev) => void {
        const handler = (rawEv: RawEv) => {
            /* QuickJS, the current interpreter used by Minecraft BE,
             * doesn't provide a mechanism to catch unhandled rejection of
             * promises. But it's common that the listener is actually an
             * async function and it doesn't catch exceptions. When that
             * happens exceptions get lost and cause a great confusion, so
             * if the function returns a promise attach a handler to catch
             * them all. */
            const ret = cb(this.#glueEv(rawEv));
            Promise.resolve(ret).catch(e => console.error(e));
        };

        this.#signal.subscribe(handler);
        this.#handlers.set(cb, handler);
        return cb;
    }

    public unsubscribe(cb: (ev: Ev) => void): void {
        const handler = this.#handlers.get(cb);
        if (handler) {
            this.#signal.unsubscribe(handler);
            this.#handlers.delete(cb);
        }
    }
}

/** Package private */
export class GluedEventSignalWithOptions<Ev, Opts, RawEv, RawOpts> implements IEventSignalWithOptions<Ev, Opts> {
    readonly #signal:   IEventSignalWithOptions<RawEv, RawOpts>;
    readonly #glueEv:   (rawEv: RawEv) => Ev;
    readonly #glueOpts: (opts: Opts) => RawOpts;
    readonly #handlers: Map<(ev: Ev) => void, (rawEv: RawEv) => void>;

    constructor(rawSignal: IEventSignalWithOptions<RawEv, RawOpts>,
                glueEv: (rawEv: RawEv) => Ev,
                glueOpts: (opts: Opts) => RawOpts) {
        this.#signal   = rawSignal;
        this.#glueEv   = glueEv;
        this.#glueOpts = glueOpts;
        this.#handlers = new Map();
    }

    public subscribe(cb: (ev: Ev) => void, opts?: Opts): (ev: Ev) => void {
        const handler = (rawEv: RawEv) => {
            // See comments on
            // GluedEventSignalWithoutOptions.prototype.subscribe
            const ret = cb(this.#glueEv(rawEv));
            Promise.resolve(ret).catch(e => console.error(e));
        };

        this.#signal.subscribe(handler, opts ? this.#glueOpts(opts) : undefined);
        this.#handlers.set(cb, handler);
        return cb;
    }

    public unsubscribe(cb: (ev: Ev) => void): void {
        const handler = this.#handlers.get(cb);
        if (handler) {
            this.#signal.unsubscribe(handler);
            this.#handlers.delete(cb);
        }
    }
}

/** Package private: The sole reason this class exists is that we want to
 * catch unhandled rejection of promises. */
export class PassThruEventSignal<Ev> implements IEventSignal<Ev> {
    readonly #glued: GluedEventSignalWithoutOptions<Ev, Ev>;

    constructor(rawSignal: IEventSignalWithoutOptions<Ev>) {
        this.#glued = new GluedEventSignalWithoutOptions(rawSignal, (ev) => ev);
    }

    public subscribe(cb: (ev: Ev) => void): (ev: Ev) => void {
        this.#glued.subscribe(cb);
        return cb;
    }

    public unsubscribe(cb: (ev: Ev) => void): void {
        this.#glued.unsubscribe(cb);
    }
}
