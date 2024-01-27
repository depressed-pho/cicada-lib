export interface ReversibleIterable<T> extends Iterable<T> {
    reverse(): Iterator<T>;
}

export interface ReversibleIterableIterator<T> extends IterableIterator<T> {
    reverse(): IterableIterator<T>;
}

export function reversible<T>(xs: IterableIterator<T>, reverse: () => IterableIterator<T>): ReversibleIterableIterator<T> {
    // We can't just create an object having reverse() and set its
    // prototype to xs, because calling next() on the original iterator
    // would involve a wrong `this` object.
    return new Proxy(xs, {
        get(_targ: any, key: PropertyKey): any {
            if (key === "reverse") {
                return reverse.bind(xs);
            }
            else {
                const prop: any = (xs as any)[key];
                return typeof prop === "function"
                    ? prop.bind(xs)
                    : prop;
            }
        }
    });
}

export function* fromIterable<T>(xs: Iterable<T>): IterableIterator<T> {
    for (const x of xs)
        yield x;
}

export function* map<T, U>(xs: Iterable<T>, f: (x: T) => U): IterableIterator<U> {
    for (const x of xs)
        yield f(x);
}

export function* concat<T>(xs: Iterable<T>, ys: Iterable<T>): IterableIterator<T> {
    yield* xs;
    yield* ys;
}

export function* intersperse<T>(sep: T, xs: Iterable<T>): IterableIterator<T> {
    let isFirst = true;
    for (const x of xs) {
        if (isFirst) {
            isFirst = false;
        }
        else {
            yield sep;
        }
        yield x;
    }
}

export function* snoc<T>(xs: Iterable<T>, x: T): Iterable<T> {
    yield* xs;
    yield  x;
}
