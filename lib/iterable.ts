export function* map<T, U>(xs: Iterable<T>, f: (x: T) => U): IterableIterator<U> {
    for (const x of xs) {
        yield f(x);
    }
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
