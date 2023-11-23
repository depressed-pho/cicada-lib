import { Notify } from "./notify.js"

/** A multi-producer, multi-consumer channel that only retains the last
 * seen value. Producers can update the value at any time. Consumers can
 * observe the latest value, and can also wait for it to be updated.
 */
export class Watch<T> {
    #latest: T;
    #seen: boolean;
    #updated: Notify;

    /** Create a new watch channel with an initial value. The initial value
     * is considered "seen", that is, `changed()` will not return until a
     * subsequent value is set.
     */
    public constructor(value: T) {
        this.#latest  = value;
        this.#seen    = true;
        this.#updated = new Notify();
    }

    /** Update the value of the channel and unblock consumers that are
     * waiting for the update.
     */
    public set(value: T) {
        this.#latest = value;
        this.#seen   = false;
        this.#updated.notifyAll();
    }

    /** Get the latest value of the channel and mark it as seen. */
    public get(): T {
        this.#seen = true;
        return this.#latest;
    }

    /** Wait for the value to be updated, then mark the newest value as
     * seen. If the newest value has not yet been marked seen when this
     * method is called, the method marks the value seen and return
     * immediately. Otherwise it blocks until `set()` is called.
     */
    public async changed(): Promise<void> {
        if (this.#seen) {
            await this.#updated.notified();
        }
        this.#seen = true;
    }

    /** Wait for a value that satisfies the given predicate. Once the
     * predicate returns `true`, this method will return the value that
     * passed the test. If the current value already satisfies the
     * predicate, this method returns immediately regardless of whether
     * it's marked seen or not.
     */
    public async waitFor(f: (value: T) => boolean): Promise<T> {
        while (true) {
            if (f(this.#latest)) {
                return this.#latest;
            }
            await this.changed();
        }
    }
}
