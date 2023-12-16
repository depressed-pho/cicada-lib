import { Hasher } from "../hasher.js";

/** Used to test the equality of two values. */
export type EqualFn<T> = (a: T, b: T) => boolean;

/** Used to hash a value. */
export type HashFn<T> = (hasher: Hasher, value: T) => void;

/** Unordered finite set, similar to the built-in `Set` but can have
 * user-supplied hash function and equality. The type `T` may not be
 * inhabited by `undefined`. Any attempts on inserting `undefined` as an
 * element will result in a `TypeError`.
 *
 * This implementation is based on the following paper:
 * https://www.csd.uoc.gr/~hy460/pdf/Dynamic%20Hash%20Tables.pdf
 */
export class HashSet<T> implements Set<T> {
    readonly #eq: EqualFn<T>;
    readonly #hash: HashFn<T>;
    // Initially we have only 1 bucket.
    #buckets: Bucket<T>[];
    // The number of times we have doubled the number of buckets.
    #numDoubled: number;
    // The index of the next bucket to split.
    #bucketToSplit: number;
    // The number of elements in the set.
    #size: number;
    // The maximum load factor: we split a bucket when we are going to
    // exceed this.
    #maxLoadFactor: number;

    /** Create an empty set. If an equality is provided, the elements will
     * be compared using the given function instead of the language
     * built-in `===` operator. */
    public constructor(equalFn?: EqualFn<T>, hashFn?: HashFn<T>, maxLoadFactor?: number);

    /** Create a set from an iterator of elements. */
    public constructor(elements: Iterable<T>, equalFn?: EqualFn<T>,
                       hashFn?: HashFn<T>, maxLoadFactor?: number);

    public constructor(...args: any[]) {
        this.#buckets       = [new Bucket()];
        this.#numDoubled    = 0;
        this.#bucketToSplit = 0;
        this.#size          = 0;
        this.#maxLoadFactor = 1.0;

        switch (args.length) {
            case 0:
                this.#eq   = defaultEq<T>;
                this.#hash = defaultHash<T>;
                break;
            case 1:
                if (typeof args[0] === "function") {
                    this.#eq   = args[0];
                    this.#hash = defaultHash<T>;
                }
                else if (args[0] instanceof HashSet) {
                    // Special case: we can safely clone the map.
                    this.#eq            = args[0].#eq;
                    this.#hash          = args[0].#hash;
                    this.#buckets       = args[0].#buckets.map(b => b.clone());
                    this.#numDoubled    = args[0].#numDoubled;
                    this.#bucketToSplit = args[0].#bucketToSplit;
                    this.#size          = args[0].#size;
                    this.#maxLoadFactor = args[0].#maxLoadFactor;
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
                if (typeof args[0] === "function") {
                    this.#eq   = args[0];
                    this.#hash = args[1];
                }
                else {
                    this.#eq   = args[1];
                    this.#hash = defaultHash<T>;
                    for (const e of args[0]) {
                        this.add(e);
                    }
                }
                break;
            case 3:
                if (typeof args[0] === "function") {
                    if (args[2] <= 0) {
                        throw new RangeError(`maxLoadFactor must be a positive number: args[2]`);
                    }
                    this.#eq            = args[0];
                    this.#hash          = args[1];
                    this.#maxLoadFactor = args[2];
                }
                else {
                    this.#eq            = args[1];
                    this.#hash          = args[2];
                    for (const e of args[0]) {
                        this.add(e);
                    }
                }
                break;
            case 4:
                if (args[3] <= 0) {
                    throw new RangeError(`maxLoadFactor must be a positive number: args[3]`);
                }
                this.#eq            = args[1];
                this.#hash          = args[2];
                this.#maxLoadFactor = args[3];
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

    /** The current load factor of the hash set. */
    public get loadFactor(): number {
        return this.#size / this.#buckets.length;
    }

    /** The maximum load factor of the hash set. */
    public get maxLoadFactor(): number {
        return this.#maxLoadFactor;
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

        if (this.#bucketFor(element).add(element, this.#eq)) {
            // The bucket increased its size. Maybe we should grow?
            this.#size++;
            while (this.loadFactor > this.#maxLoadFactor) {
                this.#grow();
            }
        }
        return this;
    }

    /** Remove all elements from the set. */
    public clear() {
        this.#buckets       = [new Bucket()];
        this.#numDoubled    = 0;
        this.#bucketToSplit = 0;
        this.#size          = 0;
    }

    /** Delete an element from the set. Return `true` iff the element was
     * present.
     */
    public "delete"(element: T): boolean {
        if (this.#bucketFor(element).delete(element, this.#eq)) {
            // The bucket decreased its size. Maybe we should shrink?
            this.#size--;
            while (this.#buckets.length > 1 &&
                   (this.#size / (this.#buckets.length - 1)) <= this.#maxLoadFactor) {
                // Shrinking would not make the load factor exceed its
                // limit. Do it.
                this.#shrink();
            }
            return true;
        }
        else {
            return false;
        }
    }

    /** Return a new set consisting of elements of `this` not existing in
     * the set `s`.
     */
    public difference(s: HashSet<T>): HashSet<T> {
        // NOTE: If two sets have identical equality, hash function, and
        // the number of buckets, maybe we can optimize this a bit by
        // directly working on buckets from the two sets. I don't think
        // it's worth it though.
        const ret = new HashSet<T>(this.#eq, this.#hash, this.#maxLoadFactor);
        for (const e of this.values()) {
            if (!s.has(e)) ret.add(e);
        }
        return ret;
    }

    /** Iterate over elements in the set. */
    public *entries(): IterableIterator<[T, T]> {
        for (const bucket of this.#buckets) {
            for (const e of bucket) {
                yield [e, e];
            }
        }
    }

    /** Apply the given function to each element in the map. */
    public forEach(f: (value: T, key: T, set: Set<T>) => any, thisArg?: any) {
        const boundF = f.bind(thisArg);
        for (const e of this) {
            boundF(e, e, this);
        }
    }

    /** See if an element is in the set. */
    public has(element: T): boolean {
        return this.#bucketFor(element).has(element, this.#eq);
    }

    /** Return a new set consisting of elements of `this` that are also
     * existing in the set `s`.
     */
    public intersection(s: HashSet<T>): HashSet<T> {
        // See a comment in difference().
        const ret = new HashSet<T>(this.#eq, this.#hash, this.#maxLoadFactor);
        for (const e of this.values()) {
            if (s.has(e)) ret.add(e);
        }
        return ret;
    }

    /** Return `true` iff `this` and the set `s` contain no common
     * elements.
     */
    public isDisjointFrom(s: HashSet<T>): boolean {
        // See a comment in difference().
        for (const e of this.values()) {
            if (s.has(e)) return false;
        }
        return true;
    }

    /** Return `true` iff every element of `this` is also an element of
     * `s`.
     */
    public isSubsetOf(s: HashSet<T>): boolean {
        // See a comment in difference().
        for (const e of this.values()) {
            if (!s.has(e)) return false;
        }
        return true;
    }

    /** Return `true` iff every element of `s` is also an element of
     * `this`.
     */
    public isSupersetOf(s: HashSet<T>): boolean {
        // See a comment in difference().
        for (const e of s.values()) {
            if (!this.has(e)) return false;
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
        for (const e of s.values()) {
            if (!ret.has(e)) {
                ret.add(e);
            }
        }
        return ret;
    }

    /** Iterate over elements in the set. */
    public *values(): IterableIterator<T> {
        for (const bucket of this.#buckets) {
            yield* bucket;
        }
    }

    #bucketFor(element: T): Bucket<T> {
        let numBuckets0 = 1;
        for (let i = 0; i < this.#numDoubled; i++) {
            numBuckets0 <<= 1;
        }

        const hash = this.#hashFor(element);
        let   idx  = hash % numBuckets0;
        if (idx < this.#bucketToSplit) {
            // This bucket has already been split. Recompute the index with
            // the doubled number.
            idx = hash % (numBuckets0 << 1);
        }

        return this.#buckets[idx]!;
    }

    #hashFor(element: T): number {
        const hasher = new Hasher();
        this.#hash(hasher, element);
        return hasher.final();
    }

    #grow() {
        let numBuckets0 = 1;
        for (let i = 0; i < this.#numDoubled; i++) {
            numBuckets0 <<= 1;
        }
        const numBuckets1 = numBuckets0 << 1;

        const toSplit = this.#buckets[this.#bucketToSplit]!;
        const newIdx  = this.#buckets.length;

        const bucket0 = new Bucket<T>();
        const bucket1 = new Bucket<T>();
        for (const element of toSplit) {
            if (this.#hashFor(element) % numBuckets1 === newIdx)
                // This one should be relocated to the new bucket because
                // its hash value has changed.
                bucket1.unsafeAdd(element);
            else
                // This one should stay in the old bucket because its hash
                // value has not changed.
                bucket0.unsafeAdd(element);
        }
        this.#buckets[this.#bucketToSplit] = bucket0;
        this.#buckets.push(bucket1);

        this.#bucketToSplit++;
        if (this.#bucketToSplit >= numBuckets0) {
            this.#numDoubled++;
            this.#bucketToSplit = 0;
        }
    }

    #shrink() {
        let numBuckets0 = 1;
        for (let i = 0; i < this.#numDoubled; i++) {
            numBuckets0 <<= 1;
        }
        const numBuckets1 = numBuckets0 >> 1;

        if (this.#bucketToSplit === 0) {
            if (this.#numDoubled === 0)
                throw new Error("Internal error: the table cannot shrink any further");
            this.#bucketToSplit = numBuckets1;
            this.#numDoubled--;
        }
        this.#bucketToSplit--;

        const mergeTo   = this.#buckets[this.#bucketToSplit]!;
        const mergeFrom = this.#buckets.pop()!;
        for (const pair of mergeFrom) {
            // We can safely do this because it had a different hash value
            // under the old hash. The elements have definitely no
            // duplicates.
            mergeTo.unsafeAdd(pair);
        }
    }
}

function defaultEq<K>(a: K, b: K): boolean {
    return a === b;
}

function defaultHash<K>(hasher: Hasher, k: K) {
    hasher.update(k);
}

class Bucket<T> implements Iterable<T> {
    #entries: T[];

    public constructor() {
        this.#entries = [];
    }

    /** Return `true` iff the size of the bucket increased. */
    public "add"(element: T, eq: EqualFn<T>): boolean {
        for (const e of this.#entries) {
            if (eq(e, element))
                return false;
        }

        this.unsafeAdd(element);
        return true;
    }

    public clone(): Bucket<T> {
        const ret = new Bucket<T>();
        ret.#entries = this.#entries.slice();
        return ret;
    }

    public has(element: T, eq: EqualFn<T>): boolean {
        for (const e of this.#entries) {
            if (eq(e, element))
                return true;
        }
        return false;
    }

    public unsafeAdd(element: T) {
        this.#entries.push(element);
    }

    /** Return `true` iff the element was present. */
    public "delete"(element: T, eq: EqualFn<T>): boolean {
        for (let i = 0; i < this.#entries.length; i++) {
            if (eq(this.#entries[i]!, element)) {
                // THINKME: Maybe we should implement a singly-linked list?
                this.#entries.splice(i, 1);
                return true;
            }
        }
        return false;
    }

    public [Symbol.iterator](): IterableIterator<T> {
        return this.#entries[Symbol.iterator]();
    }
}
