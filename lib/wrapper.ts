export class Wrapper<T> {
    readonly #raw: T;

    /// @internal
    public constructor(raw: T) {
        this.#raw = raw;
    }

    /// @internal
    public get raw(): T {
        return this.#raw;
    }
}
