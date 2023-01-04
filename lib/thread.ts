export class Thread {
    readonly #task: AsyncGenerator;
    readonly id: number;
    name: string;
    #result: Promise<IteratorResult<unknown>>;
    #isCancelRequested: boolean;
    #cancel: () => void;

    /** The ID of the next thread to be created. */
    static #nextThreadID: number = 0;

    public constructor(task: (cancelled: Promise<never>) => AsyncGenerator, name?: string) {
        // One of the two mechanisms to cancel a thread. The promise is
        // passed to the async generator function and will never be
        // resolved. When the a cancellation is requested, the promise will
        // be rejected.
        const cancelled = new Promise<never>((_resolve, reject) => {
            this.#cancel = reject;
        });

        // Attach a no-op handler to the cancellation promise, or the
        // runtime will think its rejection is accidentally unhandled.
        cancelled.catch(() => {});

        this.#task              = task(cancelled);
        this.id                 = Thread.#nextThreadID++;
        this.name               = name != null ? name : `thread-${this.id}`;
        this.#isCancelRequested = false;
        this.#cancel            = () => {}; // This will soon be clobbered.

        /* Since this.#task is an async generator and we haven't called its
         * .next() even once, the generator isn't yet running even
         * asynchronously. Schedule its execution before returning from the
         * constructor.
         *
         * And when the promise is fulfilled or rejected, we should
         * continue the execution of the task until it finishes or raises
         * an error.
         */
        this.#result = this.#task.next()
            .then(res => this.#onSuspended(res),
                  e   => this.#onError(e));
    }

    #onSuspended(res: IteratorResult<unknown>): Promise<IteratorResult<unknown>> {
        if (res.done) {
            return Promise.resolve(res);
        }
        else {
            /* Throwing an exception into the generator would work most of
             * the time, unless the generator is awaiting a promise. In
             * that case, what happens is that the generator yields an
             * unfulfilled promise and the execution stops at "cont.then()"
             * below, which won't be interrupted by this.#task.throw(). So
             * when a generator does "yield await", it has to
             * Promise.race() with the cancellation promise in order to
             * respond to requests in a timely manner. */
            const cont = this.#isCancelRequested
                ? this.#task.throw(new ThreadCancellationRequested())
                : this.#task.next();

            return cont.then(res => this.#onSuspended(res),
                             e   => this.#onError(e));
        }
    }

    #onError(e: any): Promise<IteratorResult<unknown>> {
        if (e instanceof ThreadCancellationRequested) {
            // The thread didn't catch the cancellation request, which is
            // perfectly fine.
        }
        else {
            console.error(e);
        }

        // NOTE: Returning a rejected promise here will make join() reject,
        // which is not desirable for us.
        return Promise.resolve({value: undefined, done: true});
    }

    /** Return a promise which will be resolved when the thread terminates
     * either by exiting normally or throwing an error. Getting a
     * cancellation request and not catching it also counts as throwing an
     * error. If the thread has already terminated, the resulting promise
     * will be an already resolved one.
     *
     * Note that unlike the POSIX threading API, it is perfectly fine to
     * join a thread twice or more. Subsequent joins will just return
     * resolved promises.
     */
    public async join(): Promise<void> {
        /* We really want to prevent deadlocks by attempting to join a
         * thread from within itself. But the exact moment when the
         * interpreter evaluates the generator isn't under our control so
         * we can't detect deadlocks.
         *
         * Maybe we can take the same abysmal approach as zone.js from
         * Angular but we of course don't want to. Maybe one day we can do
         * better when https://www.proposals.es/proposals/Async%20Context
         * is implemented.
         */
        await this.#result;
    }

    /** Request a cancellation of a thread. The thread is expected to
     * terminate itself shortly, but there's no guarantee of that. This
     * operation is asynchronous, that is, `cancel()` may return before the
     * thread actually terminates. If you want to wait for its termination,
     * call `join()` after this.
     */
    public cancel(): this {
        this.#isCancelRequested = true;
        this.#cancel(); // Reject the cancellation promise.
        return this;
    }
}

export class ThreadCancellationRequested extends Error {
    public constructor(message?: string, options?: ErrorOptions) {
        super(message, options);
    }
}
