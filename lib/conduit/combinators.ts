import { Buffer } from "../buffer.js";
import * as B from "../buffer/builder.js";
import { Conduit, awaitC, conduit, leftover, yieldC } from "../conduit.js";
import { lazy } from "../lazy.js";
import { head, length, subarray } from "./sequence.js";

// The type system of TypeScript is so useless here. Most of these
// combinators cannot be meaningfully typed.

export function dropE(len: number) /* : Conduit<Seq, never, void> */ {
    return conduit(function* () {
        for (let rem = len; rem > 0; ) {
            const chunk = yield* awaitC;
            if (chunk) {
                const l = length(chunk);
                const y = subarray(chunk, rem);
                if (l - rem > 0)
                    yield* leftover(y);
                rem -= l;
            }
            else {
                break;
            }
        }
    });
}

export const headE /* : Conduit<Seq, void, Element<Seq> */ =
    lazy(() =>
        conduit(function* () {
            while (true) {
                const chunk = yield* awaitC;
                if (chunk) {
                    const l = length(chunk);
                    if (l > 1) {
                        yield* leftover(subarray(chunk, 1));
                        return head(chunk)! as any;
                    }
                    else if (l > 0) {
                        // It was a singleton sequence.
                        return head(chunk)! as any;
                    }
                    // It was an empty chunk. Peek the next one.
                }
                else {
                    return undefined;
                }
            }
        }));

export const peekE /* : Conduit<Seq, void, Element<Seq> */ =
    lazy(() =>
        conduit(function* () {
            while (true) {
                const chunk = yield* awaitC;
                if (chunk) {
                    const h = head(chunk);
                    if (h !== undefined) {
                        yield* leftover(chunk);
                        return h as any;
                    }
                    // It was an empty chunk. Peek the next one.
                }
                else {
                    return undefined;
                }
            }
        }));

export function takeE(len: number) /* : Conduit<Seq, Seq, void> */ {
    return conduit(function* () {
        for (let rem = len; rem > 0; ) {
            const chunk = yield* awaitC;
            if (chunk) {
                const l = length(chunk);
                const x = subarray(chunk, 0, rem);
                yield* yieldC(x);
                if (l - rem > 0) {
                    const y = subarray(chunk, rem);
                    yield* leftover(y);
                }
                rem -= l;
            }
            else {
                break;
            }
        }
    });
}

export function takeExactlyE<I, O, R>(len: number, inner: Conduit<I, O, R>): Conduit<any, unknown, R> /* Conduit <I, O, R> */ {
    return takeE(len).fuse(
        conduit(function* () {
            const r = yield* inner;
            yield* sinkNull;
            return r;
        }));
}

export function peekForeverE<I, O>(inner: Conduit<I, O, void>): Conduit<any, any, void> /* Conduit<I, O, void> */ {
    return conduit(function* () {
        while (true) {
            const h = yield* peekE;
            if (h !== undefined)
                yield* inner;
            else
                break;
        }
    });
}

export const sinkNull: Conduit<unknown, unknown, void> =
    lazy(() =>
        conduit(function* () {
            while (true) {
                const input = yield* awaitC;
                if (input === undefined)
                    return;
            }
        }));

export const sinkBuffer: Conduit<Buffer, never, Buffer> =
    lazy(() =>
        conduit(function* () {
            let buf;
            let copied = false;
            while (true) {
                const chunk = yield* awaitC;
                if (chunk) {
                    if (!buf) {
                        // This is the first chunk we've seen. No
                        // need to copy it.
                        buf = chunk;
                    }
                    else if (copied) {
                        // We have already taken a copy. Just append it.
                        buf.append(chunk);
                    }
                    else {
                        // buf isn't a copy yet.
                        buf = new Buffer(buf);
                        buf.append(chunk);
                        copied = true;
                    }
                }
                else {
                    if (!buf)
                        return new Buffer();
                    else
                        return buf;
                }
            }
        }));

export const sinkBuilder: Conduit<B.Op, never, Buffer> =
    lazy(() =>
        conduit(function* () {
            let builder = new B.Builder();
            while (true) {
                const op = yield* awaitC;
                if (op)
                    builder.append(op);
                else
                    break;
            }
            return builder.toBuffer();
        }));

export const sinkString: Conduit<string, never, string> =
    lazy(() =>
        conduit(function* () {
            const chunks = [];
            while (true) {
                const chunk = yield* awaitC;
                if (chunk)
                    chunks.push(chunk);
                else
                    return chunks.join("");
            }
        }));

export function yieldMany<O>(xs: Iterable<O>): Conduit<unknown, O, void> {
    return conduit(function* () {
        for (const x of xs) {
            yield* yieldC(x);
        }
    });
}
