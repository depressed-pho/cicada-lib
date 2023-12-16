import { CombineFn } from "./ordered-map.js";
import { EqualFn, HashFn } from "./hash-set.js";
import { Hasher } from "../hasher.js";

/** Unordered finite map, similar to the built-in `Map` but can have
 * user-supplied hash function and equality. The type `K` can be anything
 * while the type `V` may not be inhabited by `undefined`. Any attempts on
 * inserting `undefined` as a value will result in a `TypeError`.
 *
 * This implementation is based on the following paper:
 * https://www.csd.uoc.gr/~hy460/pdf/Dynamic%20Hash%20Tables.pdf
 */
export class HashMap<K, V> implements Map<K, V> {
    readonly #eq: EqualFn<K>;
    readonly #hash: HashFn<K>;
    // Initially we have only 1 bucket.
    #buckets: Bucket<K, V>[];
    // The number of times we have doubled the number of buckets.
    #numDoubled: number;
    // The index of the next bucket to split.
    #bucketToSplit: number;
    // The number of key/value pairs in the map.
    #size: number;
    // The maximum load factor: we split a bucket when we are going to
    // exceed this.
    #maxLoadFactor: number;

    /** Create an empty map. If an equality is provided, the keys will be
     * compared using the given function instead of the language built-in
     * `===` operator. */
    public constructor(equalFn?: EqualFn<K>, hashFn?: HashFn<K>, maxLoadFactor?: number);

    /** Create a map from an iterator of key/value pair. */
    public constructor(entries: Iterable<[K, V]>, equalFn?: EqualFn<K>,
                       hashFn?: HashFn<K>, maxLoadFactor?: number);

    public constructor(...args: any[]) {
        this.#buckets       = [new Bucket()];
        this.#numDoubled    = 0;
        this.#bucketToSplit = 0;
        this.#size          = 0;
        this.#maxLoadFactor = 1.0;

        switch (args.length) {
            case 0:
                this.#eq   = defaultEq<K>;
                this.#hash = defaultHash<K>;
                break;
            case 1:
                if (typeof args[0] === "function") {
                    this.#eq   = args[0];
                    this.#hash = defaultHash<K>;
                }
                else if (args[0] instanceof HashMap) {
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
                    this.#eq   = defaultEq<K>;
                    this.#hash = defaultHash<K>;
                    for (const [k, v] of args[0]) {
                        this.set(k, v);
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
                    this.#hash = defaultHash<K>;
                    for (const [k, v] of args[0]) {
                        this.set(k, v);
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
                    for (const [k, v] of args[0]) {
                        this.set(k, v);
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
                for (const [k, v] of args[0]) {
                    this.set(k, v);
                }
                break;
            default:
                throw new TypeError("Wrong number of arguments");
        }
    }

    /** The number of key/value pairs in the map. */
    public get size(): number {
        return this.#size;
    }

    /** The current load factor of the hash map. */
    public get loadFactor(): number {
        return this.#size / this.#buckets.length;
    }

    /** The maximum load factor of the hash map. */
    public get maxLoadFactor(): number {
        return this.#maxLoadFactor;
    }

    /** This is identical to {@link entries}. */
    public [Symbol.iterator](): IterableIterator<[K, V]> {
        return this.entries();
    }

    public get [Symbol.toStringTag](): string {
        return "HashMap";
    }

    /** Remove all elements from the map. */
    public clear() {
        this.#buckets       = [new Bucket()];
        this.#numDoubled    = 0;
        this.#bucketToSplit = 0;
        this.#size          = 0;
    }

    /** Delete a key and its value from the map. Return `true` iff the key
     * was present.
     */
    public "delete"(key: K): boolean {
        if (this.#bucketFor(key).delete(key, this.#eq)) {
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

    /** Iterate over key/value pairs in the map. */
    public *entries(): IterableIterator<[K, V]> {
        for (const bucket of this.#buckets) {
            yield* bucket;
        }
    }

    /** Apply the given function to each key/value pair in the map. */
    public forEach(f: (value: V, key: K, map: Map<K, V>) => any, thisArg?: any) {
        const boundF = f.bind(thisArg);
        for (const [k, v] of this) {
            boundF(v, k, this);
        }
    }

    /** Lookup the value at a key in the map, or return `undefined` if no
     * corresponding value exists.
     */
    public "get"(key: K): V|undefined {
        return this.#bucketFor(key).get(key, this.#eq);
    }

    /** See if a key is in the map. */
    public has(key: K): boolean {
        return this.#bucketFor(key).has(key, this.#eq);
    }

    /** Iterate over keys in the map. */
    public *keys(): IterableIterator<K> {
        for (const bucket of this.#buckets) {
            yield* bucket.keys();
        }
    }

    /** Insert a new key and a value in the map. If the key is already
     * present in the map, the associated value is replaced with the
     * supplied one.
     *
     * If a combining function is supplied, and there is an old value for
     * the same key, the method instead replaces the old value with
     * `combineFn(oldValue, newValue, newKey)`.
     */
    public "set"(key: K, value: V, combineFn?: CombineFn<K, V>): this {
        if (key === undefined)
            throw new TypeError("`undefined' is not a valid key of HashMap");

        if (this.#bucketFor(key).set(key, value, this.#eq, combineFn)) {
            // The bucket increased its size. Maybe we should grow?
            this.#size++;
            while (this.loadFactor > this.#maxLoadFactor) {
                this.#grow();
            }
        }
        return this;
    }

    /** Iterate over values in the map. */
    public *values(): IterableIterator<V> {
        for (const bucket of this.#buckets) {
            yield* bucket.values();
        }
    }

    #bucketFor(key: K): Bucket<K, V> {
        let numBuckets0 = 1;
        for (let i = 0; i < this.#numDoubled; i++) {
            numBuckets0 <<= 1;
        }

        const hash = this.#hashFor(key);
        let   idx  = hash % numBuckets0;
        if (idx < this.#bucketToSplit) {
            // This bucket has already been split. Recompute the index with
            // the doubled number.
            idx = hash % (numBuckets0 << 1);
        }

        return this.#buckets[idx]!;
    }

    #hashFor(key: K): number {
        const hasher = new Hasher();
        this.#hash(hasher, key);
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

        const bucket0 = new Bucket<K, V>();
        const bucket1 = new Bucket<K, V>();
        for (const pair of toSplit) {
            if (this.#hashFor(pair[0]) % numBuckets1 === newIdx)
                // This one should be relocated to the new bucket because
                // its hash value has changed.
                bucket1.unsafeAdd(pair);
            else
                // This one should stay in the old bucket because its hash
                // value has not changed.
                bucket0.unsafeAdd(pair);
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
            // under the old hash. The keys have definitely no duplicates.
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

class Bucket<K, V> implements Iterable<[K, V]> {
    #entries: [K, V][];

    public constructor() {
        this.#entries = [];
    }

    public clone(): Bucket<K, V> {
        const ret = new Bucket<K, V>();
        ret.#entries = this.#entries.slice();
        return ret;
    }

    public "get"(key: K, eq: EqualFn<K>): V|undefined {
        for (const [k, v] of this.#entries) {
            if (eq(k, key))
                return v;
        }
        return undefined;
    }

    public has(key: K, eq: EqualFn<K>): boolean {
        for (const [k, _v] of this.#entries) {
            if (eq(k, key))
                return true;
        }
        return false;
    }

    /** Return `true` iff the size of the bucket increased. */
    public "set"(key: K, value: V, eq: EqualFn<K>, combineFn?: CombineFn<K, V>): boolean {
        for (const pair of this.#entries) {
            if (eq(pair[0], key)) {
                if (combineFn)
                    pair[1] = combineFn(pair[1], value, pair[0]);
                else
                    pair[1] = value;
                return false;
            }
        }

        this.unsafeAdd([key, value]);
        return true;
    }

    public unsafeAdd(pair: [K, V]) {
        this.#entries.push(pair);
    }

    /** Return `true` iff the key was present. */
    public "delete"(key: K, eq: EqualFn<K>): boolean {
        for (let i = 0; i < this.#entries.length; i++) {
            if (eq(this.#entries[i]![0], key)) {
                // THINKME: Maybe we should implement a singly-linked list?
                this.#entries.splice(i, 1);
                return true;
            }
        }
        return false;
    }

    public [Symbol.iterator](): IterableIterator<[K, V]> {
        return this.#entries[Symbol.iterator]();
    }

    public *keys(): IterableIterator<K> {
        for (const [k, _v] of this.#entries) {
            yield k;
        }
    }

    public *values(): IterableIterator<V> {
        for (const [_k, v] of this.#entries) {
            yield v;
        }
    }
}
