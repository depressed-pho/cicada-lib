import { List } from "./list.js";
import { UniString } from "./unicode.js";

// Always-backtracking monadic parser. Mostly a port of
// https://hackage.haskell.org/package/attoparsec
export class Parser<A> {
    public constructor(public readonly run: <R>(input: UniString,
                                                pos: number,
                                                more: boolean,
                                                onSucc: OnSuccess<A, R>,
                                                onFail: OnFail<R>) => ParserResult<R>) {}

    public then<B>(next: (value: A) => Parser<B>): Parser<B> {
        return new Parser<B>((input, pos, more, onSucc, onFail) => {
            const onSucc1 = (input1: UniString, pos1: number, more1: boolean, value: A) => {
                return next(value).run(input1, pos1, more1, onSucc, onFail);
            };
            return this.run(input, pos, more, onSucc1, onFail);
        });
    }

    public orElse(alt: Parser<A>): Parser<A> {
        return new Parser<A>((input, pos, more, onSucc, onFail) => {
            const onFail1 = (input1: UniString, _pos: number, more1: boolean,
                             _stack: List<string>, _msg: string) => {
                return alt.run(input1, pos, more1, onSucc, onFail);
            };
            return this.run(input, pos, more, onSucc, onFail1);
        });
    }

    public label(label: string): Parser<A> {
        return new Parser<A>((input, pos, more, onSucc, onFail) => {
            const onFail1 = (input1: UniString, pos1: number, more1: boolean,
                             stack: List<string>, msg: string) => {
                return onFail(input1, pos1, more1, stack.cons(label), msg);
            };
            return this.run(input, pos, more, onSucc, onFail1);
        });
    }

    public map<B>(f: (value: A) => B): Parser<B> {
        return new Parser<B>((input, pos, more, onSucc, onFail) => {
            const onSucc1 = (input1: UniString, pos1: number, more1: boolean, value: A) => {
                return onSucc(input1, pos1, more1, f(value));
            };
            return this.run(input, pos, more, onSucc1, onFail);
        });
    }
}

type OnSuccess<A, R> = (input: UniString, pos: number, more: boolean, value: A) => ParserResult<R>;
type OnFail<R>       = (input: UniString, pos: number, more: boolean, stack: List<string>, msg: string) => ParserResult<R>;

export type ParserResult<R> =
    {failed: string, rest: string, stack: string[]} |
    {done: R, rest: string} |
    {needMore: (input: string) => ParserResult<R>};


/// Run a parser.
export function parse<A>(parser: Parser<A>, input: string): ParserResult<A> {
    const onSucc = (input: UniString, pos: number, _more: boolean, value: A) => {
        return {done: value, rest: input.substring(pos).valueOf()};
    };
    const onFail = (input: UniString, pos: number, _more: boolean,
                    stack: List<string>, msg: string) => {
        return {failed: msg, rest: input.substring(pos).valueOf(), stack: Array.from(stack)};
    };
    return parser.run(new UniString(input), 0, true, onSucc, onFail);
}

/** If a parser has returned a `needMore` result, supply it with more
 * input.
 */
export function feed<A>(res: ParserResult<A>, input: string): ParserResult<A> {
    if ("failed" in res || "done" in res) {
        return {...res, rest: res.rest + input};
    }
    else {
        return res.needMore(input);
    }
}

/// Run a parser but assumes no additional input is available. Throws if
/// the parser fails.
export function parseOnly<A>(parser: Parser<A>, input: string): A {
    const onSucc = (input: UniString, pos: number, _more: boolean, value: A) => {
        return {done: value, rest: input.substring(pos).valueOf()};
    };
    const onFail = (input: UniString, pos: number, _more: boolean,
                    stack: List<string>, msg: string) => {
        return {failed: msg, rest: input.substring(pos).valueOf(), stack: Array.from(stack)};
    };
    const res = parser.run(new UniString(input), 0, false, onSucc, onFail);
    if ("failed" in res || "done" in res) {
        return getResult(res);
    }
    else {
        throw new Error("parseOnly: internal error: impossible result");
    }
}

/** Extract a parsed value out of a result. Throws if the result isn't
 * `done`.
 */
export function getResult<R>(res: ParserResult<R>): R {
    if ("failed" in res) {
        if (res.stack.length === 0) {
            throw new Error(res.failed);
        }
        else {
            const ctx: string[] = [];
            for (const label of res.stack) {
                if (ctx.length > 0) {
                    ctx.push(" > ");
                }
                ctx.push(label);
            }
            throw new Error(`${ctx.join("")}: ${res.failed}`);
        }
    }
    else if ("done" in res) {
        return res.done;
    }
    else {
        throw new Error(`getResult: incomplete input`);
    }
}

/// A parser that always succeeds without consuming input.
export function pure<A>(value: A): Parser<A> {
    return new Parser((input, pos, more, onSucc, _onFail) => {
        return onSucc(input, pos, more, value);
    });
}

/// A parser that always fails without consuming input.
export function fail(msg: string): Parser<any> {
    return new Parser((input, pos, more, _onSucc, onFail) => {
        return onFail(input, pos, more, List.empty, msg);
    });
}

/** Match any character but don't consume any input. Succeed with
 * `undefined` if no more input is available.
 */
export const peekChar: Parser<string|undefined> =
    new Parser((input, pos, more, onSucc, _onFail) => {
        if (input.length >= pos + 1) {
            return onSucc(input, pos, more, input.at(pos)!);
        }
        else if (more) {
            const onSucc1 = (input1: UniString, pos1: number, more1: boolean) => {
                return onSucc(input1, pos1, more1, input1.at(pos)!);
            };
            const onFail1 = (input1: UniString, pos1: number, more1: boolean) => {
                return onSucc(input1, pos1, more1, undefined);
            };
            return prompt(input, pos, onSucc1, onFail1);
        }
        else {
            return onSucc(input, pos, more, undefined);
        }
    });

/// Match any character but don't consume any input. Fail if no more input is
/// available.
export const peekCharOrFail: Parser<string> =
    new Parser((input, pos, more, onSucc, onFail) => {
        if (input.length >= pos + 1) {
            return onSucc(input, pos, more, input.at(pos)!);
        }
        else {
            const onSucc1 = (input1: UniString, pos1: number, more1: boolean, value: UniString) => {
                return onSucc(input1, pos1, more1, value.at(0)!);
            };
            return ensureSuspended(1, input, pos, more, onSucc1, onFail);
        }
    });

/// Match any character.
export const anyChar: Parser<string> =
    satisfy(() => true);

/** Succeed for any character which the predicate `p` returns
 * `true`. Return the character that is actually parsed.
 */
export function satisfy(p: (c: string) => boolean): Parser<string> {
    return peekCharOrFail.then(c => {
        if (p(c)) {
            return advance(1).then(() => pure(c));
        }
        else {
            return fail("satisfy");
        }
    });
}

function advance(n: number): Parser<null> {
    return new Parser((input, pos, more, onSucc, _onFail) => {
        return onSucc(input, pos + n, more, null);
    });
}

function ensureSuspended<R>(len: number, input: UniString, pos: number, more: boolean,
                            onSucc: OnSuccess<UniString, R>, onFail: OnFail<R>): ParserResult<R> {
    function go(): Parser<UniString> {
        return new Parser((input1, pos1, more1, onSucc1, onFail1) => {
            if (input1.length >= pos1 + len) {
                return onSucc1(input1, pos1, more1, input1.substring(pos1, pos1 + len));
            }
            else {
                return demandInput.then(() => go()).run(input1, pos1, more1, onSucc1, onFail1);
            }
        });
    }
    return demandInput.then(() => go()).run(input, pos, more, onSucc, onFail);
}

// If at least `n` characters of input are available, return the first n
// characters, otherwise fail.
function ensure(len: number): Parser<UniString> {
    return new Parser((input, pos, more, onSucc, onFail) => {
        if (input.length >= pos + len) {
            return onSucc(input, pos, more, input.substring(pos, pos + len));
        }
        else {
            return ensureSuspended(len, input, pos, more, onSucc, onFail);
        }
    });
}

/** Immediately demand more input via a `Partial` continuation result.
 */
const demandInput: Parser<null> =
    new Parser<null>((input, pos, more, onSucc, onFail) => {
        if (more) {
            const onSucc1 = (input1: UniString, pos1: number, more1: boolean) => {
                return onSucc(input1, pos1, more1, null);
            };
            const onFail1 = (input1: UniString, pos1: number, more1: boolean) => {
                return onFail(input1, pos1, more1, List.empty, "premature end of input");
            };
            return prompt(input, pos, onSucc1, onFail1);
        }
        else {
            return onFail(input, pos, more, List.empty, "premature end of input");
        }
    });

/// Ask for input. If we receive any, pass the augmented input to a success
/// continuation, otherwise to a failure continuation.
function prompt<R>(input: UniString, pos: number,
                   onSucc: (input1: UniString, pos1: number, more1: boolean) => ParserResult<R>,
                   onFail: (input1: UniString, pos1: number, more1: boolean) => ParserResult<R>): ParserResult<R> {
    return {
        needMore: (input1) => {
            if (input1.length > 0) {
                return onSucc(input.concat(new UniString(input1)), pos, true);
            }
            else {
                return onFail(input, pos, false);
            }
        }
    };
}

/// Parse a single ASCII digit.
export const asciiDigit: Parser<string> =
    satisfy(isAsciiDigit);

/// Return `true` iff the given string contains a single ASCII digit.
export function isAsciiDigit(c: string): boolean {
    if (c.length === 1) {
        const cp = c.codePointAt(0)!;
        return cp >= 0x30 && cp <= 0x39;
    }
    else {
        return false;
    }
}

/// Parse a single ASCII alphabet.
export const asciiAlpha: Parser<string> =
    satisfy(isAsciiAlpha);

/// Return `true` iff the given string contains a single ASCII alphabet.
export function isAsciiAlpha(c: string): boolean {
    if (c.length === 1) {
        const cp = c.codePointAt(0)!;
        return (cp >= 0x41 && cp <= 0x5A) || (cp >= 0x61 && cp <= 0x7A);
    }
    else {
        return false;
    }
}

/// Parse a single ASCII whitespace, namely SP, HT, LF, VT, FF, CR.
export const asciiSpace: Parser<string> =
    satisfy(isAsciiSpace);

/// Return `true` iff the given string contains a single ASCII whitespace.
export function isAsciiSpace(c: string): boolean {
    if (c.length === 1) {
        const cp = c.codePointAt(0)!;
        return (cp === 0x20) || (cp >= 0x09 && cp <= 0x0D);
    }
    else {
        return false;
    }
}

/// Parse a single character matching the given `RegExp`.
export function match(re: RegExp): Parser<string> {
    return satisfy(c => re.test(c));
}

/// Parse a single character that doesn't match the given `RegExp`.
export function noMatch(re: RegExp): Parser<string> {
    return satisfy(c => !re.test(c));
}

/// Parse a sequence of bytes that identically match the given string.
export function literal(str: string): Parser<string> {
    const ustr = new UniString(str);
    return ensure(ustr.length).then(got => {
        if (got.equals(ustr))
            return advance(got.length).then(() => pure(got.valueOf()));
        else
            return fail(`expected literal "${str}"`);
    });
}

const getInput: Parser<UniString> =
    new Parser((input, pos, more, onSucc, _onFail) => {
        return onSucc(input, pos, more, input.substring(pos));
    });

function inputSpansChunks(len: number): Parser<boolean> {
    return new Parser((input, pos, more, onSucc, _onFail) => {
        const pos1 = pos + len;
        if (pos1 < input.length || !more) {
            return onSucc(input, pos1, more, false);
        }
        else {
            const onSucc1 = (input1: UniString, pos2: number, more1: boolean) => {
                return onSucc(input1, pos2, more1, true);
            };
            const onFail1 = (input1: UniString, pos2: number, more1: boolean) => {
                return onSucc(input1, pos2, more1, false);
            };
            return prompt(input, pos1, onSucc1, onFail1);
        }
    });
}

function countWhile(p: (c: string) => boolean, str: UniString): number {
    let res = 0;
    for (const c of str) {
        if (p(c))
            res++;
        else
            break;
    }
    return res;
}

/// Skip over ASCII white spaces.
export const skipAsciiSpaces: Parser<null> =
    skipWhile(isAsciiSpace);

/// Skip past input for as long as the predicate returns `true`.
export function skipWhile(p: (c: string) => boolean): Parser<null> {
    function go(): Parser<null> {
        return getInput.map(input => countWhile(p, input)).then(len =>
            inputSpansChunks(len).then(spans => {
                if (spans) {
                    return go();
                }
                else {
                    return pure(null);
                }
            }));
    }
    return go();
}

/// Consume exactly `n` bytes of input.
export function take(len: number): Parser<string> {
    const n = Math.max(len, 0);
    return ensure(n).then(s =>
        advance(n).then(() =>
            pure(s.valueOf())));
}

/** A stateful scanner. The predicate consumes and transforms a state
 * argument, and each transformed state is passed to successive invocations
 * of the predicate on each byte of the input until one returns `undefined`
 * or the input ends.
 *
 * This parser does not fail. It will return an empty string if the
 * predicate returns `undefined` on the first byte of input.
 */
export function scan<S>(init: S, next: (state: S, c: string) => S|undefined): Parser<string> {
    function go(state: S, len: number): Parser<number> {
        return peekChar.then(c => {
            if (c === undefined) {
                return pure(len);
            }
            else {
                const state1 = next(state, c);
                if (state1 === undefined)
                    return pure(len);
                else
                    return go(state1, len + 1)
            }
        });
    }
    return go(init, 0).then(take);
}

/** Consume input as long as the predicate returns `true`, and return the
 * consumed input.
 *
 * This parser does not fail. It will return an empty string if the
 * predicate returns `false` on the first byte of input.
 */
export function takeWhile(p: (c: string) => boolean): Parser<string> {
    function go(acc: List<UniString>): Parser<string> {
        return getInput.then(input => {
            const len = countWhile(p, input);
            return inputSpansChunks(len).then(spans => {
                const s = input.substring(0, len);
                if (spans) {
                    return go(acc.snoc(s));
                }
                else {
                    return pure(UniString.empty.concat(...acc, s).valueOf());
                }
            });
        });
    }
    return go(List.empty);
}

/** Consume input as long as the predicate returns `true`, and return the
 * consumed input.
 *
 * This parser requires the predicate to succeed on at least one byte of
 * input: it will fail if the predicate never returns `true` or if there is
 * no input left.
 */
export function takeWhile1(p: (c: string) => boolean): Parser<string> {
    return takeWhile(p).then(str => {
        if (str.length === 0) {
            return fail(`Expected at least one character satisfying ${p}`);
        }
        else {
            return pure(str);
        }
    });
}

/** Consume input as long as the predicate returns `false`
 * (i.e. until it returns `true`), and return the consumed input.
 */
export function takeTill(p: (c: string) => boolean): Parser<string> {
    return takeWhile(c => !p(c));
}

/** This parser always succeeds. It returns `true` if any input is
 * available either immediately or on demand, and `false` if the end of all
 * input has been reached.
 */
const hasInput: Parser<boolean> =
    new Parser((input, pos, more, onSucc, _onFail) => {
        if (pos < input.length) {
            return onSucc(input, pos, more, true);
        }
        else if (!more) {
            return onSucc(input, pos, more, false);
        }
        else {
            const onSucc1 = (input1: UniString, pos1: number, more1: boolean) => {
                return onSucc(input1, pos1, more1, true);
            };
            const onFail1 = (input1: UniString, pos1: number, more1: boolean) => {
                return onSucc(input1, pos1, more1, false);
            };
            return prompt(input, pos, onSucc1, onFail1);
        }
    });

/** Consume all remaining input and return it as a single string.
*/
export const takeRest: Parser<string> = (() => {
    function go(acc: List<UniString>): Parser<string> {
        return hasInput.then(has => {
            if (has) {
                return getInput.then(s =>
                    advance(s.length).then(() =>
                        go(acc.snoc(s))));
            }
            else {
                return pure(UniString.empty.concat(...acc).valueOf());
            }
        });
    }
    return go(List.empty);
})();

/** Match either a single newline character `\n`, or a carriage return
 * followed by a newline character @\"\\r\\n\"@.
 */
export const endOfLine: Parser<string> =
    literal("\n").orElse(literal("\r\n"));

/** Parse and decode an unsigned decimal number.
 */
export const decimal: Parser<number> =
    takeWhile1(isAsciiDigit).then(digits =>
        pure(Number.parseInt(digits)));

/** Parse and decode an unsigned hexadecimal number. The hex digits `a`
 * through `f` may be upper or lower case.
 *
 * This parser does not accept a leading `0x` string.
 */
export const hexadecimal: Parser<number> = (() => {
    function isHexDigit(c: string): boolean {
        const cc = c.codePointAt(0)!;
        return (cc >= 0x30 && cc <= 0x39) ||
               (cc >= 0x41 && cc <= 0x46) ||
               (cc >= 0x61 && cc <= 0x66);
    }
    return takeWhile1(isHexDigit).then(digits =>
        pure(Number.parseInt(digits, 16)));
})();

/** Parse a number with an optional leading `+` or `-` sign character.
 */
export function signed(p: Parser<number>): Parser<number> {
    return choice([
        literal("-").then(() => p.map(n => -1 * n)),
        literal("+").then(() => p),
        p
    ]);
}

/** Parse a floating point number, e.g. `-3.25e-3`. */
export const float: Parser<number> = (() => {
    const mantissa: Parser<string> =
        takeWhile(isAsciiDigit).then(integral =>
            peekChar.then(maybeDot => {
                if (maybeDot == ".") {
                    return advance(1).then(() =>
                        takeWhile(isAsciiDigit).then(frac =>
                            pure(`${integral}.${frac}`)));
                }
                else {
                    return pure(integral);
                }
            }));

    const maybeExponent: Parser<string> =
        satisfy(c => c === "e" || c === "E").then(() =>
            signed(decimal).then(exp =>
                pure(`E${exp}`)));

    const unsignedFloat: Parser<number> =
        mantissa.then(m =>
            maybeExponent.then(e =>
                pure(Number.parseFloat(m + e))));

    return signed(unsignedFloat);
})();

/** `choice(ps)` tries to apply the parsers in the Iterable `ps` in order,
 * until one of them succeeds. Return the value of the succeeding parser.
 */
export function choice<A>(ps: Iterable<Parser<A>>): Parser<A> {
    let ret = fail("no choices were given");
    for (const p of ps) {
        ret = ret.orElse(p);
    }
    return ret.orElse(fail("no choices were taken"));
}

/** Apply the given parser repeatedly, returning every result. */
export function count<A>(n: number, p: Parser<A>): Parser<A[]> {
    function go(n: number, acc: List<A>): Parser<List<A>> {
        if (n > 0) {
            return p.then(v => go(n-1, acc.snoc(v)));
        }
        else {
            return pure(acc);
        }
    }
    return go(n, List.empty).then(vs => pure(Array.from(vs)));
}

/** Try to apply the parser `p`. If the parser fails it returns the value
 * `v`, otherwise the value returned by `p`.
 */
export function option<A>(v: A, p: Parser<A>): Parser<A> {
    return p.orElse(pure(v));
}

const getPos: Parser<number> =
    new Parser((input, pos, more, onSucc, _onFail) => {
        return onSucc(input, pos, more, pos);
    });

/** Apply the parser `p` *zero* or more times. Return an array of the
 * returned values of `p`. The parser throws if `p` succeeds without
 * consuming input, which leads to an infinite loop.
 */
export function many<A>(p: Parser<A>): Parser<A[]> {
    function go(acc: List<A>, pos0: number): Parser<A[]> {
        return p.then(value => {
            return getPos.then(pos1 => {
                if (pos1 === pos0) {
                    throw new Error(
                        "Applied to a parser that succeeds without consuming input, " +
                            "which leads to an infinite loop");
                }
                else {
                    return go(acc.snoc(value), pos1);
                }
            });
        }).orElse(pure(Array.from(acc)));
    }
    return getPos.then(pos0 => go(List.empty, pos0));
}

/** Apply the parser `p` *one* or more times. Return an array of the
 * returned values of `p`. The parser throws if `p` succeeds without
 * consuming input, which leads to an infinite loop.
 */
export function many1<A>(p: Parser<A>): Parser<A[]> {
    return p.then(value =>
        many(p).then(values => {
            values.unshift(value);
            return pure(values);
        }));
}

/** Apply the parser `p` *zero* or more times until the parser `end`
 * succeeds, and return the list of values returned by `p`. The parser
 * throws if `p` succeeds without consuming input, which leads to an
 * infinite loop.
 */
export function manyTill<A>(p: Parser<A>, end: Parser<any>): Parser<A[]> {
    function go(pos0: number, acc: List<A>): Parser<A[]> {
        return end.then(() => pure(Array.from(acc)))
            .orElse(p.then(value =>
                getPos.then(pos1 => {
                    if (pos1 === pos0) {
                        throw new Error(
                            "Applied to a parser that succeeds without consuming input, " +
                                "which leads to an infinite loop");
                    }
                    else {
                        return go(pos1, acc.snoc(value));
                    }
                })));
    }
    return getPos.then(pos0 => go(pos0, List.empty));
}

/** Apply *zero* or more occurrences of `p`, separated by `sep`. Return a
 * list of the values returned by `p`. The parser throws if both `p` and
 * `sep` succeed without consuming input, which leads to an infinite loop.
 */
export function sepBy<A>(p: Parser<A>, sep: Parser<any>): Parser<A[]> {
    return p.then(value =>
               sep.then(() => sepBy1(p, sep))
                  .orElse(pure([]))
                  .then(values => {
                      values.unshift(value);
                      return pure(values);
                  }))
            .orElse(pure([]));
}

/** Apply *one* or more occurrences of `p`, separated by `sep`. Return a
 * list of the values returned by `p`. The parser throws if both `p` and
 * `sep` succeed without consuming input, which leads to an infinite loop.
 */
export function sepBy1<A>(p: Parser<A>, sep: Parser<any>): Parser<A[]> {
    function go(pos0: number, acc: List<A>): Parser<A[]> {
        return p.then(value =>
            sep.then(() =>
                getPos.then(pos1 => {
                    if (pos1 === pos0) {
                        throw new Error(
                            "Applied to parsers that succeed without consuming input, " +
                                "which leads to an infinite loop");
                    }
                    else {
                        // When this call of go() fails, sep too fails and
                        // its consumption is canceled.
                        return go(pos1, acc.snoc(value));
                    }
                }))
               .orElse(pure(Array.from(acc.snoc(value)))));
    }
    return getPos.then(pos0 => go(pos0, List.empty));
}

/* This is like {@link many} but discards the result. The parser throws if
 * `p` succeeds without consuming input, which leads to an infinite loop.
 */
export function skipMany(p: Parser<any>): Parser<null> {
    function go(pos0: number): Parser<null> {
        return p.then(() =>
            getPos.then(pos1 => {
                if (pos1 === pos0) {
                    throw new Error(
                        "Applied to a parser that succeeds without consuming input, " +
                            "which leads to an infinite loop");
                }
                else {
                    return go(pos1);
                }
            }))
            .orElse(pure(null));
    }
    return getPos.then(go);
}

/* This is like {@link many1} but discards the result. The parser throws if
 * `p` succeeds without consuming input, which leads to an infinite loop.
 */
export function skipMany1<A>(p: Parser<A>): Parser<null> {
    return p.then(() => skipMany(p));
}

/** Match only if all input has been consumed. */
export const endOfInput: Parser<null> =
    hasInput.then(has => {
        if (has) {
            return fail("Expected the end of input but it's not");
        }
        else {
            return pure(null);
        }
    });

/** Return an indication of whether the end of input has been reached.
 */
export const atEnd: Parser<boolean> =
    hasInput.map(b => !b);
