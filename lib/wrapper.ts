export class Wrapper<T> {
    readonly #raw: T;

    /** Package private: user code should not use this. */
    public constructor(raw: T) {
        this.#raw = raw;
    }

    /** Package private: user code should not use this. */
    public get raw(): T {
        return this.#raw;
    }
}
