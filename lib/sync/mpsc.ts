import { Queue } from "../queue.js";
import { Notify } from "./notify.js";

export class ChannelBase<T> {
    protected queue: Queue<T>;
    protected readonly sent: Notify;

    public constructor() {
        this.queue = Queue.empty;
        this.sent  = new Notify();
    }

    public async receive(): Promise<T> {
        while (true) {
            if (this.queue.isEmpty) {
                await this.sent.notified();
                continue;
            }
            else {
                const [head, rest] = this.queue.uncons();
                this.queue = rest;
                return head;
            }
        }
    }

    /** If the queue is empty, block until at least one message is
     * sent. Otherwise return all the messages in the queue.
     */
    public async receiveAll(): Promise<Queue<T>> {
        while (true) {
            if (this.queue.isEmpty) {
                await this.sent.notified();
                continue;
            }
            else {
                const messages = this.queue;
                this.queue = Queue.empty;
                return messages;
            }
        }
    }
}

/** A bounded multi-producer, single-consumer queue for sending values
 * between threads. The bounded variant has a limit on the number of
 * messages that the channel can store, and if this limit is reached,
 * trying to send another message will wait until a message is received
 * from the channel.
 */
export class Channel<T> extends ChannelBase<T> {
    readonly limit: number;
    readonly #received: Notify;

    public constructor(limit: number) {
        super();
        this.limit     = limit;
        this.#received = new Notify();
    }

    public override async receive(): Promise<T> {
        const message = await super.receive();
        this.#received.notifyAll();
        return message;
    }

    public override async receiveAll(): Promise<Queue<T>> {
        const messages = await super.receiveAll();
        this.#received.notifyAll();
        return messages;
    }

    public async send(value: T): Promise<void> {
        while (true) {
            if (this.queue.length < this.limit) {
                this.queue = this.queue.snoc(value);
                this.sent.notifyAll();
                return;
            }
            else {
                await this.#received.notified();
                continue;
            }
        }
    }
}

/** An unbounded multi-producer, single-consumer queue for sending values
 * between threads. An unbounded channel has an infinite capacity, so the
 * send method will always complete immediately. This makes the
 * `UnboundedChannel` usable from both synchronous and asynchronous code.
 */
export class UnboundedChannel<T> extends ChannelBase<T> {
    public send(value: T) {
        this.queue = this.queue.snoc(value);
        this.sent.notifyAll();
    }
}
