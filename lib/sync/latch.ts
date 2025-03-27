/** A downward counter which can be used to synchronise threads. The value
 * of the counter is initialized on creation. Threads may block on the
 * latch until the counter is decremented to zero. There is no possibility
 * to increase or reset the counter, which makes the latch a single-use
 * barrier.
 */
export class Latch {
    #counter: number;

    readonly #future: Promise<void>;
    // @ts-ignore: this property is definitely initialised in the
    // constructor but TypeScript cannot prove it.
    readonly #zeroed: () => void;

    /** Create a new latch with an initial value. The value must be a
     * non-negative integer.
     */
    public constructor(value: number) {
        if (value < 0)
            throw TypeError(`value must be non-negative: ${value}`);

        this.#counter = value;
        this.#future  = new Promise((resolve, _reject) => {
            // @ts-ignore: TypeScript cannot prove this assignment to a
            // readonly property is actually safe.
            this.#zeroed = resolve;
        });
    }

    /** Decrement the internal counter by a given number, or 1 if
     * omitted. The number must be non-negative. If it's greater than the
     * value of the internal counter, the counter is set to zero.
     */
    public countDown(value = 1) {
        if (value < 0)
            throw TypeError(`value must be non-negative: ${value}`);

        this.#counter = Math.max(0, this.#counter - value);

        if (this.#counter == 0)
            this.#zeroed();
    }

    /** Return `true` iff the internal counter reached zero.
     */
    public tryWait(): boolean {
        return this.#counter == 0;
    }

    /** Return a promise that is fulfilled when the internal counter
     * reaches zero.
     */
    public async wait(): Promise<void> {
        return this.#future;
    }

    /** Decrement the internal counter by a given number, or 1 if
     * omitted. Return a promise that is fulfilled when the internal
     * counter reaches zero.
     */
    public async arriveAndWait(value = 1): Promise<void> {
        this.countDown(value);
        return this.wait();
    }
}
