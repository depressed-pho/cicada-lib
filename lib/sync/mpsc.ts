import { Queue } from "../queue.js";
import { Notify } from "./notify.js";

/** A bounded multi-producer, single-consumer queue for sending values
 * between threads. The bounded variant has a limit on the number of
 * messages that the channel can store, and if this limit is reached,
 * trying to send another message will wait until a message is received
 * from the channel.
 */
export class Channel<T> {
    readonly limit: number;
    #queue: Queue<T>;
    readonly #sent: Notify;
    readonly #received: Notify;

    public constructor(limit: number) {
        this.limit     = limit;
        this.#queue    = Queue.empty;
        this.#sent     = new Notify();
        this.#received = new Notify();
    }

    public async send(value: T): Promise<void> {
        while (true) {
            if (this.#queue.length < this.limit) {
                this.#queue = this.#queue.snoc(value);
                this.#sent.notifyAll();
                return;
            }
            else {
                await this.#received.notified();
                continue;
            }
        }
    }

    public async receive(): Promise<T> {
        while (true) {
            if (this.#queue.isEmpty) {
                await this.#sent.notified();
                continue;
            }
            else {
                const [head, rest] = this.#queue.uncons();
                this.#queue = rest;
                this.#received.notifyOne();
                return head;
            }
        }
    }
}

/** An unbounded multi-producer, single-consumer queue for sending values
 * between threads. An unbounded channel has an infinite capacity, so the
 * send method will always complete immediately. This makes the
 * `UnboundedChannel` usable from both synchronous and asynchronous code.
 */
export class UnboundedChannel<T> {
    #queue: Queue<T>;
    readonly #sent: Notify;
    readonly #received: Notify;

    public constructor() {
        this.#queue    = Queue.empty;
        this.#sent     = new Notify();
        this.#received = new Notify();
    }

    public send(value: T) {
        this.#queue = this.#queue.snoc(value);
        this.#sent.notifyAll();
    }

    public async receive(): Promise<T> {
        while (true) {
            if (this.#queue.isEmpty) {
                await this.#sent.notified();
                continue;
            }
            else {
                const [head, rest] = this.#queue.uncons();
                this.#queue = rest;
                this.#received.notifyOne();
                return head;
            }
        }
    }
}
