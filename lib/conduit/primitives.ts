import { lazy } from "../lazy.js";

const SHaveOutput = Symbol("SHaveOutput");
interface HaveOutput<O> {
    type: typeof SHaveOutput;
    output: O;
}
const SNeedInput = Symbol("SNeedInput");
interface NeedInput {
    type: typeof SNeedInput;
}
const SLeftover = Symbol("SLeftover");
interface Leftover<L> {
    type: typeof SLeftover;
    leftover: L;
}
export type Step<L, O>
    = HaveOutput<O>
    | NeedInput
    | Leftover<L>;

const SHaveInput = Symbol("SHaveInput");
interface HaveInput<I> {
    type: typeof SHaveInput;
    input: I;
}
const SClosed = Symbol("SClosed");
interface Closed<U> {
    type: typeof SClosed;
    result: U;
}
export type Supply<I, U>
    = HaveInput<I>
    | Closed<U>;

export abstract class Conduit<I, O, R> {
    public abstract [Symbol.iterator](): Generator<Step<I, O>, R, Supply<I, unknown>>;

    public async *[Symbol.asyncIterator](): AsyncGenerator<Step<I, O>, R, Supply<I, unknown>> {
        return yield* this[Symbol.iterator]();
    }

    public fuse<O1, R1>(down: Conduit<O, O1, R1>): Conduit<I, O1, R1> {
        const up = this;

        class Fused extends Conduit<I, O1, R1> {
            public *[Symbol.iterator](): Generator<Step<I, O1>, R1, Supply<I, unknown>> {
                let upG;
                const downG = down[Symbol.iterator]();
                let upSup: Supply<I, unknown>|undefined;
                let downSup: Supply<O, R>|undefined;
                let goDown = true;
                const leftovers = [];
                while (true) {
                    if (goDown) {
                        const ret = downSup ? downG.next(downSup) : downG.next();
                        downSup = undefined;

                        if (ret.done) {
                            // The downstream is now closed, which means we
                            // no longer run the upstream also.
                            return ret.value;
                        }
                        else {
                            const step = ret.value as Step<O, O1>;
                            switch (step.type) {
                                case SHaveOutput:
                                    // The downstream yielded an output,
                                    // which means this fused conduit
                                    // should also yield it.
                                    yield step;
                                    break;
                                case SNeedInput:
                                    // The downstream needs an input. Do we
                                    // have any leftovers?
                                    if (leftovers.length > 0) {
                                        // Yup. Give it back to the
                                        // downstream.
                                        downSup = {
                                            type:  SHaveInput,
                                            input: leftovers.pop()!
                                        };
                                    }
                                    else {
                                        // Nope. Switch to the upstream.
                                        goDown = false;
                                    }
                                    break;
                                case SLeftover:
                                    // The downstream yielded a leftover input,
                                    // so the next time it requests for an
                                    // input give the leftover back to the
                                    // downstream.
                                    leftovers.push(step.leftover);
                                    break;
                            }
                        }
                    }
                    else { // !goDown
                        if (!upG)
                            // We haven't even started the upstream. Do it
                            // now.
                            upG = up[Symbol.iterator]();
                        const ret = upSup ? upG.next(upSup) : upG.next();
                        upSup = undefined;

                        if (ret.done) {
                            // Tell the downstream, which is awaiting for
                            // an input, that the upstream is now closed.
                            downSup = {
                                type:   SClosed,
                                result: ret.value
                            };
                            goDown = true;
                        }
                        else {
                            const step = ret.value as Step<I, O>;
                            switch (step.type) {
                                case SHaveOutput:
                                    // The upstream yielded an output. Feed
                                    // the downstream with it.
                                    downSup = {
                                        type:  SHaveInput,
                                        input: step.output
                                    };
                                    goDown = true;
                                    break;
                                case SNeedInput:
                                    // Ask the upstream's upstream for an input
                                    // so that we can resume the upstream with
                                    // it.
                                    upSup = yield step;
                                    break;
                                case SLeftover:
                                    // The upstream yielded a leftover
                                    // input, so the fused conduit should
                                    // also yield a leftover.
                                    yield step;
                                    break;
                            }
                        }
                    }
                }
            }

            public override async *[Symbol.asyncIterator](): AsyncGenerator<Step<I, O1>, R1, Supply<I, unknown>> {
                // This is mostly the same as
                // Fused.prototype[@@iterator]()... We hate code
                // duplication but we don't think it's avoidable.
                let upG;
                const downG = down[Symbol.asyncIterator]();
                let upSup: Supply<I, unknown>|undefined;
                let downSup: Supply<O, R>|undefined;
                let goDown = true;
                const leftovers = [];
                while (true) {
                    if (goDown) {
                        const ret = await (downSup ? downG.next(downSup) : downG.next());
                        downSup = undefined;

                        if (ret.done) {
                            // The downstream is now closed, which means we
                            // no longer run the upstream also.
                            return ret.value;
                        }
                        else {
                            const step = ret.value as Step<O, O1>;
                            switch (step.type) {
                                case SHaveOutput:
                                    // The downstream yielded an output,
                                    // which means this fused conduit
                                    // should also yield it.
                                    yield step;
                                    break;
                                case SNeedInput:
                                    // The downstream needs an input. Do we
                                    // have any leftovers?
                                    if (leftovers.length > 0) {
                                        // Yup. Give it back to the
                                        // downstream.
                                        downSup = {
                                            type:  SHaveInput,
                                            input: leftovers.pop()!
                                        };
                                    }
                                    else {
                                        // Nope. Switch to the upstream.
                                        goDown = false;
                                    }
                                    break;
                                case SLeftover:
                                    // The downstream yielded a leftover input,
                                    // so the next time it requests for an
                                    // input give the leftover back to the
                                    // downstream.
                                    leftovers.push(step.leftover);
                                    break;
                            }
                        }
                    }
                    else { // !goDown
                        if (!upG)
                            // We haven't even started the upstream. Do it
                            // now.
                            upG = up[Symbol.asyncIterator]();
                        const ret = await (upSup ? upG.next(upSup) : upG.next());
                        upSup = undefined;

                        if (ret.done) {
                            // Tell the downstream, which is awaiting for
                            // an input, that the upstream is now closed.
                            downSup = {
                                type:   SClosed,
                                result: ret.value
                            };
                            goDown = true;
                        }
                        else {
                            const step = ret.value as Step<I, O>;
                            switch (step.type) {
                                case SHaveOutput:
                                    // The upstream yielded an output. Feed
                                    // the downstream with it.
                                    downSup = {
                                        type:  SHaveInput,
                                        input: step.output
                                    };
                                    goDown = true;
                                    break;
                                case SNeedInput:
                                    // Ask the upstream's upstream for an input
                                    // so that we can resume the upstream with
                                    // it.
                                    upSup = yield step;
                                    break;
                                case SLeftover:
                                    // The upstream yielded a leftover
                                    // input, so the fused conduit should
                                    // also yield a leftover.
                                    yield step;
                                    break;
                            }
                        }
                    }
                }
            }
        }
        return new Fused();
    }

    public run(): R {
        const ret = this[Symbol.iterator]().next();
        if (ret.done)
            return ret.value;
        else
            throw new TypeError(`The conduit yielded when it shouldn't: ${ret.value}`);
    }

    public async runAsync(): Promise<R> {
        const ret = await this[Symbol.asyncIterator]().next();
        if (ret.done)
            return ret.value;
        else
            throw new TypeError(`The conduit yielded when it shouldn't: ${ret.value}`);
    }
}

// Primitives

export function conduit<I, O, R>(f: () => Generator<Step<I, O>, R, Supply<I, unknown>>
                                ): Conduit<I, O, R> {
    class Wrapped extends Conduit<I, O, R> {
        public [Symbol.iterator](): Generator<Step<I, O>, R, Supply<I, unknown>> {
            return f();
        }

        [Symbol.for("nodejs.util.inspect.custom")](_depth: number, _opts: any, _inspect: any) {
            return `Wrapped ${f.toString()}`;
        }
    }
    return new Wrapped();
}

export const awaitC: Conduit<any, never, any|undefined> =
    lazy(() => {
        class Await<I> extends Conduit<I, never, I|undefined> {
            public *[Symbol.iterator](): Generator<Step<I, never>, I|undefined, Supply<I, unknown>> {
                const supply = yield {type: SNeedInput};
                switch (supply.type) {
                    case SHaveInput:
                        return supply.input;
                    case SClosed:
                        return undefined;
                }
            }
        }
        return new Await();
    });

export function awaitForever<I, O>(f: (input: I) => Conduit<unknown, O, void>): Conduit<I, O, void> {
    class AwaitForever extends Conduit<I, O, void> {
        public *[Symbol.iterator](): Generator<Step<I, O>, void, Supply<I, unknown>> {
            while (true) {
                const supply = yield {type: SNeedInput};
                switch (supply.type) {
                    case SHaveInput:
                        yield* f(supply.input) as Conduit<any, O, void>;
                        break;
                    case SClosed:
                        return;
                }
            }
        }
    }
    return new AwaitForever();
}

export function leftover<I>(input: I): Conduit<I, unknown, void> {
    class Leftover extends Conduit<I, unknown, void> {
        public *[Symbol.iterator](): Generator<Step<I, unknown>, void> {
            yield {
                type: SLeftover,
                leftover: input
            };
        }
    }
    return new Leftover();
}

export function yieldC<O>(output: O): Conduit<unknown, O, void> {
    class Yield extends Conduit<unknown, O, void> {
        public *[Symbol.iterator](): Generator<Step<unknown, O>, void> {
            yield {
                type: SHaveOutput,
                output
            };
        }
    }
    return new Yield();
}

export class PrematureEOF extends Error {
    public constructor(...args: ConstructorParameters<typeof Error>) {
        super(...args);
    }
}
