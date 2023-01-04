/**
 * An implementation of node.js EventEmitter that is suitable for the Bedrock engine.
 */

export type EventName = string | symbol;

interface Listener {
    fn: Function;
    once: boolean;
};

export class EventEmitter {
    /* Invariant: Listener[] isn't empty. */
    #events: Map<EventName, Listener[]>;

    /* Invariant: these numbers are positive. */
    static #defaultMaxListeners: number = 10;
    #maxListeners?: number;

    public constructor() {
        this.#events = new Map<EventName, Listener[]>();
    }

    public addListener(name: EventName, fn: Function): this {
        return this.#addListener(name, {fn, once: false}, false);
    }

    public get defaultMaxListeners(): number {
        return EventEmitter.#defaultMaxListeners;
    }

    public set defaultMaxListeners(n: number) {
        if (n > 0) {
            EventEmitter.#defaultMaxListeners = n;
        }
        else if (n == 0) {
            EventEmitter.#defaultMaxListeners = Infinity;
        }
        else {
            throw new RangeError(`defaultMaxListeners cannot be negative: ${n}`);
        }
    }

    public emit(name: EventName, ...args: any[]): boolean {
        const listeners = this.#events.get(name);
        if (listeners) {
            for (const listener of listeners) {
                if (listener.once) {
                    this.removeListener(name, listener.fn);
                }
                /* QuickJS, the current interpreter used by Minecraft BE,
                 * doesn't provide a mechanism to catch unhandled rejection
                 * of promises. But it's common that the listener is
                 * actually an async function and it doesn't catch
                 * exceptions. When that happens exceptions get lost and
                 * cause a great confusion, so if the function returns a
                 * promise attach a handler to catch them all. */
                const ret = listener.fn(...args);
                Promise.resolve(ret).catch(e => console.error(e));
            }
            return true;
        }
        else {
            return false;
        }
    }

    public eventNames(): EventName[] {
        return Array.from(this.#events.keys());
    }

    public getMaxListeners(): number {
        if (this.#maxListeners === undefined) {
            return EventEmitter.#defaultMaxListeners;
        }
        else {
            return this.#maxListeners;
        }
    }

    public listenerCount(name: EventName): number {
        const listeners = this.#events.get(name);
        return listeners ? listeners.length : 0;
    }

    public listeners(name: EventName): Function[] {
        const listeners = this.#events.get(name);
        return listeners ? listeners.map(listener => listener.fn) : [];
    }

    public off(name: EventName, fn: Function): this {
        return this.removeListener(name, fn);
    }

    public on(name: EventName, fn: Function): this {
        return this.#addListener(name, {fn, once: false}, false);
    }

    public once(name: EventName, fn: Function): this {
        return this.#addListener(name, {fn, once: true}, false);
    }

    public prependListener(name: EventName, fn: Function): this {
        return this.#addListener(name, {fn, once: false}, true);
    }

    public prependOnceListener(name: EventName, fn: Function): this {
        return this.#addListener(name, {fn, once: true}, true);
    }

    public removeAllListeners(name?: EventName): this {
        if (name === undefined) {
            this.#events.clear();
        }
        else {
            this.#events.delete(name);
        }
        return this;
    }

    public removeListener(name: EventName, fn: Function): this {
        const listeners = this.#events.get(name);
        if (listeners) {
            const newListeners: Listener[] = [];
            let removedOne = false;

            for (const listener of listeners) {
                if (removedOne || listener.fn !== fn) {
                    newListeners.push(listener);
                }
                else {
                    removedOne = true;
                }
            }

            if (newListeners.length > 0) {
                this.#events.set(name, newListeners);
            }
            else {
                this.#events.delete(name);
            }
        }
        return this;
    }

    public setMaxListeners(n: number): this {
        if (n > 0) {
            this.#maxListeners = n;
        }
        else if (n == 0) {
            this.#maxListeners = Infinity;
        }
        else {
            throw new RangeError(`setMaxListeners() cannot be called with a negative number: ${n}`);
        }
        return this;
    }

    #addListener(name: EventName, listener: Listener, prepend: boolean): this {
        this.emit("newListener", name, listener.fn);

        const listeners = this.#events.get(name);
        if (listeners) {
            if (prepend) {
                listeners.unshift(listener);
            }
            else {
                listeners.push(listener);
            }
        }
        else {
            this.#events.set(name, [listener]);
        }

        return this;
    }
}
