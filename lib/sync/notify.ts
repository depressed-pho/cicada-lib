import { Queue } from "../collections/queue.js";

/** `Notify` provides a basic mechanism to notify a single thread of an
 * event. `Notify` itself does not carry any data. Instead, it is to be
 * used to signal another thread to perform an operation.
 */
export class Notify {
    #waiters: Queue<() => void>;
    #permitted: boolean;

    public constructor() {
        this.#waiters = Queue.empty;
        this.#permitted = false;
    }

    /** Wait for a notification.
     *
     * Each Notify value holds a single permit. If a permit is available
     * from an earlier call to `notifyOne()`, then `notified()` will
     * complete immediately, consuming that permit. Otherwise, `notified()`
     * waits for a permit to be made available by the next call to
     * `notifyOne()`.
     */
    public async notified(): Promise<void> {
        if (this.#permitted) {
            // Return an already resolved Promise.
            this.#permitted = false;
            return Promise.resolve();
        }
        else {
            // Push an unfulfilled Promise to the queue and return it.
            return new Promise((resolve, _reject) => {
                this.#waiters = this.#waiters.snoc(resolve);
            });
        }
    }

    /** Notify a waiting thread.
     *
     * If a thread is currently waiting, that thread is
     * notified. Otherwise, a permit is stored in this `Notify` value and
     * the next call to `notified()` will complete immediately consuming
     * the permit made available by this call to `notifyOne()`.
     *
     * At most one permit may be stored by `Notify`. Many sequential calls
     * to `notifyOne()` will result in a single permit being stored. The next
     * call to `notified()` will complete immediately, but the one after
     * that will wait.
     */
    public notifyOne() {
        if (this.#waiters.isEmpty) {
            // No waiters exist. Store a permit.
            this.#permitted = true;
        }
        else {
            // Awake one waiting thread.
            const [head, rest] = this.#waiters.uncons();
            this.#waiters = rest;
            head();
        }
    }

    /**
     * Notify all waiting threads.
     *
     * If a thread is currently waiting, that thread is notified. Unlike
     * with `notifyOne()`, no permit is stored to be used by the next call
     * to `notified()`. The purpose of this method is to notify all already
     * registered waiters.
     */
    public notifyAll() {
        const waiters = this.#waiters;
        this.#waiters = Queue.empty;
        for (const waiter of waiters) {
            waiter();
        }
    }
}
