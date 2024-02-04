export function spawn(gen: (cancelled: Promise<never>) => AsyncGenerator): Thread;
export function spawn(name: string, gen: (cancelled: Promise<never>) => AsyncGenerator): Thread;
export function spawn(...args: any[]) {
    let name: string|undefined;
    let gen: (cancelled: Promise<never>) => AsyncGenerator;
    switch (args.length) {
        case 1:
            name = args[0].name === "" ? "<anonymous>" : args[0].name;
            gen  = args[0];
            break;
        case 2:
            name = args[0];
            gen  = args[1];
    }

    class T extends Thread {
        protected readonly run = gen;
    }
    return new T(name).start();
}

export abstract class Thread {
    #task?: AsyncGenerator;
    readonly id: number;
    name: string;
    #result?: Promise<IteratorResult<unknown>>;
    #isCancelRequested: boolean;
    #cancel: () => void;

    /** The ID of the next thread to be created. */
    static #nextThreadID: number = 0;

    public constructor(name?: string) {
        this.id                 = Thread.#nextThreadID++;
        this.name               = name != null ? name : new.target.name;
        this.#isCancelRequested = false;
        // This will be clobbered when the thread starts running.
        this.#cancel            = () => {};
    }

    /** An abstract method that will be invoked to run the task of the
     * thread.
     */
    protected abstract run(cancelled: Promise<never>): AsyncGenerator;

    /** Start the thread. It doesn't start on its own just by constructing
     * an instance, because that means `run()` would be invoked even before
     * constructors of subclasses complete.
     */
    public start(): this {
        // One of the two mechanisms to cancel a thread. The promise is
        // passed to the async generator function and will never be
        // resolved. When a cancellation is requested, the promise will be
        // rejected.
        const cancelled = new Promise<never>((_resolve, reject) => {
            this.#cancel = reject;
        });

        // Attach a no-op handler to the cancellation promise, or the
        // runtime will think its rejection is accidentally unhandled.
        cancelled.catch(() => {});

        // This method might be called in the context of before events,
        // which means we might be in a read-only mode. The task should
        // await (or yield in our case since we ignore any yielded values)
        // at least once so that it can mutate the world state.
        const self = this;
        this.#task = (async function* () {
            // Await a Promise that is already fulfilled with null. This is
            // a no-op except that the async function still pauses briefly.
            await null;
            yield* self.run(cancelled);
        })();

        /* Since this.#task is an async generator and we haven't called its
         * .next() even once, the generator isn't running yet even
         * asynchronously. Schedule its execution now.
         *
         * And when the promise is fulfilled, we should continue the
         * execution of the task until it finishes or raises an error.
         */
        this.#result = this.#task.next()
            .then(res => this.#onSuspended(res),
                  e   => this.#onError(e));

        return this;
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
                ? this.#task!.throw(new ThreadCancellationRequested())
                : this.#task!.next();

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
            console.error(
                "Thread #%d (%s) aborted: %o",
                this.id, this.name, e);
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

export class ThreadCancellationRequested extends Error {}
