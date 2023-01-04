export function* concat<T>(xs: Iterable<T>, ys: Iterable<T>): Iterable<T> {
    yield* xs;
    yield* ys;
}

export function* intersperse<T>(sep: T, xs: Iterable<T>): Iterable<T> {
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
