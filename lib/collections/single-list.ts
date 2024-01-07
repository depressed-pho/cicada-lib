/** A mutable singly-linked list. It's very inconvenient and is mostly for
 * internal use.
 */
export type SList<T> = null | SCell<T>;

export interface SCell<T> {
    value: T;
    next: SList<T>;
}
