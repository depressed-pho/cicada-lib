import { SList } from "./single-list.js";
import { Hasher } from "../hasher.js";
import { map } from "../iterable.js";

/** Used to test the equality of two values. */
export type EqualFn<T> = (a: T, b: T) => boolean;

/** Used to hash a value. */
export type HashFn<T> = (hasher: Hasher, value: T) => void;

/** Unordered finite set, similar to the built-in `Set` but can have
 * user-supplied hash function and equality. The type `T` may not be
 * inhabited by `undefined`. Any attempts on inserting `undefined` as an
 * element will result in a `TypeError`.
 *
 * This implementation does not maintain a hash table on its own. It
 * instead relies on the standard `Map` class internally.
 */
export class HashSet<T> implements Set<T> {
    readonly #eq: EqualFn<T>;
    readonly #hash: HashFn<T>;
    readonly #hasher: Hasher;
    readonly #buckets: Map<number, Bucket<T>>;
    // The number of elements in the set.
    #size: number;

    /** Create an empty map with the default equality (the language
     * built-in `===` operator) and the default hash function which works
     * for any primitive values and plain objects.
     */
    public constructor();

    /** Create an empty set with a custom equality and a hash function.
     *
     * There is a law that the functions must follow. For any elements e1
     * and e2, if `equalFn(e1, e2)` then `hashFn(e1) === hashFn(e2)`.
     */
    public constructor(equalFn: EqualFn<T>, hashFn: HashFn<T>);

    /** Create a set from an iterator of elements with the default equality
     * and the default hash function, or if `entries` is an instance of
     * `HashSet`, the same equality and the hash function will be used.
     */
    public constructor(elements: Iterable<T>);

    /** Create a set from an iterator of elements with a custom equality
     * and a hash function.
     */
    public constructor(elements: Iterable<T>, equalFn: EqualFn<T>, hashFn: HashFn<T>);

    public constructor(...args: any[]) {
        this.#hasher  = new Hasher();
        this.#buckets = new Map();
        this.#size    = 0;

        switch (args.length) {
            case 0:
                this.#eq   = defaultEq<T>;
                this.#hash = defaultHash<T>;
                break;
            case 1:
                if (args[0] instanceof HashSet) {
                    // Special case: we can safely clone the set.
                    this.#eq      = args[0].#eq;
                    this.#hash    = args[0].#hash;
                    this.#buckets = new Map(map(args[0].#buckets,
                                                ([hash, bucket]) => [hash, bucket.clone()]));
                    this.#size    = args[0].#size;
                }
                else {
                    this.#eq   = defaultEq<T>;
                    this.#hash = defaultHash<T>;
                    for (const e of args[0]) {
                        this.add(e);
                    }
                }
                break;
            case 2:
                this.#eq   = args[0];
                this.#hash = args[1];
                break;
            case 3:
                // We cannot clone the set even if the Iterable is actually
                // a HashSet, because hash functions may not be the same.
                this.#eq   = args[1];
                this.#hash = args[2];
                for (const e of args[0]) {
                    this.add(e);
                }
                break;
            default:
                throw new TypeError("Wrong number of arguments");
        }
    }

    /** The number of elements in the set. */
    public get size(): number {
        return this.#size;
    }

    /** This is identical to {@link values}. */
    public [Symbol.iterator](): IterableIterator<T> {
        return this.values();
    }

    public get [Symbol.toStringTag](): string {
        return "HashSet";
    }

    /** Insert a new element in the set. If the element is already
     * present in the set, it is replaced with the supplied one.
     */
    public add(element: T): this {
        if (element === undefined)
            throw new TypeError("`undefined' is not a valid element of HashSet");

        const hash   = this.#hashFor(element);
        const bucket = this.#buckets.get(hash);
        if (bucket) {
            if (bucket.add(element, this.#eq))
                this.#size++;
        }
        else {
            this.#buckets.set(hash, new Bucket<T>(element));
            this.#size++;
        }

        return this;
    }

    /** Remove all elements from the set. */
    public clear() {
        this.#buckets.clear();
        this.#size = 0;
    }

    /** Delete an element from the set. Return `true` iff the element was
     * present.
     */
    public "delete"(element: T): boolean {
        const hash   = this.#hashFor(element);
        const bucket = this.#buckets.get(hash);
        if (bucket) {
            if (bucket.delete(element, this.#eq)) {
                if (bucket.isEmpty)
                    this.#buckets.delete(hash);
                this.#size--;
                return true;
            }
        }
        return false;
    }

    /** Delete a single element in the set and return it if any. Do nothing
     * if the set is empty.
     */
    public deleteAny(): T|undefined {
        for (const [hash, bucket] of this.#buckets) {
            const elem = bucket.deleteAny();
            if (elem) {
                if (bucket.isEmpty)
                    this.#buckets.delete(hash);
                this.#size--;
                return elem;
            }
        }
        return undefined;
    }

    /** Return a new set consisting of elements of `this` not existing in
     * the set `s`.
     */
    public difference(s: HashSet<T>): HashSet<T> {
        // NOTE: If two sets have an identical equality and a hash
        // function, maybe we can optimize this a bit by directly working
        // on buckets from the two sets. I don't think it's worth it
        // though.
        const ret = new HashSet<T>(this.#eq, this.#hash);
        for (const elem of this.values()) {
            if (!s.has(elem)) ret.add(elem);
        }
        return ret;
    }

    /** Iterate over elements in the set. */
    public *entries(): IterableIterator<[T, T]> {
        for (const bucket of this.#buckets.values()) {
            for (const elem of bucket) {
                yield [elem, elem];
            }
        }
    }

    /** Apply the given function to each element in the set. */
    public forEach(f: (value: T, key: T, set: Set<T>) => any, thisArg?: any) {
        const boundF = f.bind(thisArg);
        for (const bucket of this.#buckets.values()) {
            for (const elem of bucket) {
                boundF(elem, elem, this);
            }
        }
    }

    /** See if an element is in the set. */
    public has(element: T): boolean {
        const hash   = this.#hashFor(element);
        const bucket = this.#buckets.get(hash);
        return bucket ? bucket.has(element, this.#eq) : false;
    }

    /** Return a new set consisting of elements of `this` that are also
     * existing in the set `s`.
     */
    public intersection(s: HashSet<T>): HashSet<T> {
        // See a comment in difference().
        const ret = new HashSet<T>(this.#eq, this.#hash);
        for (const elem of this.values()) {
            if (s.has(elem)) ret.add(elem);
        }
        return ret;
    }

    /** Return `true` iff `this` and the set `s` contain no common
     * elements.
     */
    public isDisjointFrom(s: HashSet<T>): boolean {
        // See a comment in difference().
        for (const elem of this.values()) {
            if (s.has(elem)) return false;
        }
        return true;
    }

    /** Return `true` iff every element of `this` is also an element of
     * `s`.
     */
    public isSubsetOf(s: HashSet<T>): boolean {
        // See a comment in difference().
        for (const elem of this.values()) {
            if (!s.has(elem)) return false;
        }
        return true;
    }

    /** Return `true` iff every element of `s` is also an element of
     * `this`.
     */
    public isSupersetOf(s: HashSet<T>): boolean {
        // See a comment in difference().
        for (const elem of s.values()) {
            if (!this.has(elem)) return false;
        }
        return true;
    }

    /** Iterate over elements in the set. This is identical to {@link
     * values}.
     */
    public keys(): IterableIterator<T> {
        return this.values();
    }

    /** Return a new set consisting of elements of either `this` or `s` but
     * not both.
     */
    public symmetricDifference(s: HashSet<T>): HashSet<T> {
        // See a comment in difference().
        const s1 = this.difference(s);
        const s2 = s.difference(this);
        return s1.union(s2);
    }

    /** Take the left-biased union of `this` and `s`. The function returns
     * a new set without modifying existing ones.
     */
    public union(s: HashSet<T>): HashSet<T> {
        // See a comment in difference().
        const ret = new HashSet<T>(this);
        for (const elem of s.values()) {
            if (!ret.has(elem)) {
                ret.add(elem);
            }
        }
        return ret;
    }

    /** Iterate over elements in the set. */
    public *values(): IterableIterator<T> {
        for (const bucket of this.#buckets.values()) {
            yield* bucket;
        }
    }

    #hashFor(element: T): number {
        this.#hash(this.#hasher, element);
        const hash = this.#hasher.final();
        this.#hasher.reset();
        return hash;
    }
}

function defaultEq<K>(a: K, b: K): boolean {
    return a === b;
}

function defaultHash<K>(hasher: Hasher, k: K) {
    hasher.update(k);
}

class Bucket<T> implements Iterable<T> {
    #entries: SList<T>;

    public constructor(elem?: T);
    public constructor(...args: any[]) {
        this.#entries =
            args.length === 0
            ? null
            : {value: args[0], next: null};
    }

    public get isEmpty(): boolean {
        return this.#entries == null;
    }

    /** Return `true` iff the size of the bucket increased. */
    public "add"(elem: T, eq: EqualFn<T>): boolean {
        for (let cell = this.#entries; cell; cell = cell.next) {
            if (eq(cell.value, elem))
                return false;
        }
        this.#entries = {value: elem, next: this.#entries};
        return true;
    }

    public clone(): Bucket<T> {
        const ret = new Bucket<T>();
        // Can't just copy this.#entries because it's mutable (and we
        // actually mutate it).
        for (let cell = this.#entries, prev = null; cell; cell = cell.next) {
            const cloned: SList<T> = {value: cell.value, next: null};
            if (prev)
                prev.next = cloned;
            else
                ret.#entries = cloned;
            prev = cloned;
        }
        return ret;
    }

    public has(elem: T, eq: EqualFn<T>): boolean {
        for (let cell = this.#entries; cell; cell = cell.next) {
            if (eq(cell.value, elem))
                return true;
        }
        return false;
    }

    /** Return `true` iff the element was present. */
    public "delete"(elem: T, eq: EqualFn<T>): boolean {
        for (let cell = this.#entries, prev = null; cell; prev = cell, cell = cell.next) {
            if (eq(cell.value, elem)) {
                if (prev)
                    prev.next = cell.next;
                else
                    this.#entries = cell.next;
                return true;
            }
        }
        return false;
    }

    public deleteAny(): T|undefined {
        if (this.#entries) {
            const elem = this.#entries.value;
            this.#entries = this.#entries.next;
            return elem;
        }
        return undefined;
    }

    public *[Symbol.iterator](): IterableIterator<T> {
        for (let cell = this.#entries; cell; cell = cell.next) {
            yield cell.value;
        }
    }
}
