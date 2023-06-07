/** The identity function. */
export function identity<T>(x: T): T {
    return x;
}

/** Create a constant function for a given value. */
export function constant<T>(x: T): () => T {
    return () => x;
}
