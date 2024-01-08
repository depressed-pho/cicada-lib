/** `DeepRequired<T>` is like `Required<T>` but is recursive. */
export type DeepRequired<T> = Required<{
    [K in keyof T]: DeepRequired<T[K]>
}>;
