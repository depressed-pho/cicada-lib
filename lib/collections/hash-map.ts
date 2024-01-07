import { SList } from "./single-list.js";
import { CombineFn } from "./ordered-map.js";
import { EqualFn, HashFn } from "./hash-set.js";
import { Hasher } from "../hasher.js";
import { map } from "../iterable.js";

/** Unordered finite map, similar to the built-in `Map` but can have
 * user-supplied hash function and equality. The type `K` can be anything
 * while the type `V` may not be inhabited by `undefined`. Any attempts on
 * inserting `undefined` as a value will result in a `TypeError`.
 *
 * This implementation does not maintain a hash table on its own. It
 * instead relies on the standard `Map` class internally.
 */
export class HashMap<K, V> implements Map<K, V> {
    readonly #eq: EqualFn<K>;
    readonly #hash: HashFn<K>;
    readonly #hasher: Hasher;
    readonly #buckets: Map<number, Bucket<K, V>>;
    // The number of key/value pairs in the map.
    #size: number;

    /** Create an empty map with the default equality (the language
     * built-in `===` operator) and the default hash function which works
     * for any primitive values and plain objects.
     */
    public constructor();

    /** Create an empty map with a custom equality and a hash function.
     *
     * There is a law that the functions must follow. For any keys k1 and
     * k2, if `equalFn(k1, k2)` then `hashFn(k1) === hashFn(k2)`.
     */
    public constructor(equalFn: EqualFn<K>, hashFn: HashFn<K>);

    /** Create a map from an iterable object of key/value pair with the
     * default equality and the default hash function, or if `entries` is
     * an instance of `HashMap`, the same equality and the hash function
     * will be used.
     */
    public constructor(entries: Iterable<[K, V]>);

    /** Create a map from an iterable object of key/value pair with a
     * custom equality and a hash function.
     */
    public constructor(entries: Iterable<[K, V]>, equalFn: EqualFn<K>, hashFn: HashFn<K>);

    public constructor(...args: any[]) {
        this.#hasher  = new Hasher();
        this.#buckets = new Map();
        this.#size    = 0;

        switch (args.length) {
            case 0:
                this.#eq   = defaultEq<K>;
                this.#hash = defaultHash<K>;
                break;
            case 1:
                if (args[0] instanceof HashMap) {
                    // Special case: we can safely clone the map.
                    this.#eq      = args[0].#eq;
                    this.#hash    = args[0].#hash;
                    this.#buckets = new Map(map(args[0].#buckets,
                                                ([hash, bucket]) => [hash, bucket.clone()]));
                    this.#size    = args[0].#size;
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
                this.#eq   = args[0];
                this.#hash = args[1];
                break;
            case 3:
                // We cannot clone the map even if the Iterable is actually
                // a HashMap, because hash functions may not be the same.
                this.#eq   = args[1];
                this.#hash = args[2];
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

    /** This is identical to {@link entries}. */
    public [Symbol.iterator](): IterableIterator<[K, V]> {
        return this.entries();
    }

    public get [Symbol.toStringTag](): string {
        return "HashMap";
    }

    /** Remove all elements from the map. */
    public clear() {
        this.#buckets.clear();
        this.#size = 0;
    }

    /** Delete a key and its value from the map. Return `true` iff the key
     * was present.
     */
    public "delete"(key: K): boolean {
        const hash   = this.#hashFor(key);
        const bucket = this.#buckets.get(hash);
        if (bucket) {
            if (bucket.delete(key, this.#eq)) {
                if (bucket.isEmpty)
                    this.#buckets.delete(hash);
                this.#size--;
                return true;
            }
        }
        return false;
    }

    /** Delete a single key/value pair in the map and return it if any. Do
     * nothing if the map is empty.
     */
    public deleteAny(): [K, V]|undefined {
        for (const [hash, bucket] of this.#buckets) {
            const pair = bucket.deleteAny();
            if (pair) {
                if (bucket.isEmpty)
                    this.#buckets.delete(hash);
                this.#size--;
                return pair;
            }
        }
        return undefined;
    }

    /** Iterate over key/value pairs in the map. */
    public *entries(): IterableIterator<[K, V]> {
        for (const bucket of this.#buckets.values()) {
            yield* bucket;
        }
    }

    /** Apply the given function to each key/value pair in the map. */
    public forEach(f: (value: V, key: K, map: Map<K, V>) => any, thisArg?: any) {
        const boundF = f.bind(thisArg);
        for (const bucket of this.#buckets.values()) {
            for (const [k, v] of bucket) {
                boundF(v, k, this);
            }
        }
    }

    /** Lookup the value at a key in the map, or return `undefined` if no
     * corresponding value exists.
     */
    public "get"(key: K): V|undefined {
        const hash   = this.#hashFor(key);
        const bucket = this.#buckets.get(hash);
        return bucket?.get(key, this.#eq);
    }

    /** See if a key is in the map. */
    public has(key: K): boolean {
        const hash   = this.#hashFor(key);
        const bucket = this.#buckets.get(hash);
        return bucket ? bucket.has(key, this.#eq) : false;
    }

    /** Iterate over keys in the map. */
    public *keys(): IterableIterator<K> {
        for (const bucket of this.#buckets.values()) {
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

        const hash   = this.#hashFor(key);
        const bucket = this.#buckets.get(hash);
        if (bucket) {
            if (bucket.set(key, value, this.#eq, combineFn))
                this.#size++;
        }
        else {
            this.#buckets.set(hash, new Bucket<K, V>(key, value));
            this.#size++;
        }

        return this;
    }

    /** Iterate over values in the map. */
    public *values(): IterableIterator<V> {
        for (const bucket of this.#buckets.values()) {
            yield* bucket.values();
        }
    }

    #hashFor(key: K): number {
        this.#hash(this.#hasher, key);
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

class Bucket<K, V> implements Iterable<[K, V]> {
    #entries: SList<[K, V]>;

    public constructor();
    public constructor(key: K, value: V);
    public constructor(...args: any[]) {
        this.#entries =
            args.length === 0
            ? null
            : {value: args as [K, V], next: null};
    }

    public get isEmpty(): boolean {
        return this.#entries == null;
    }

    public clone(): Bucket<K, V> {
        const ret = new Bucket<K, V>();
        for (let cell = this.#entries, prev = null; cell; cell = cell.next) {
            const cloned: SList<[K, V]> = {value: cell.value, next: null};
            if (prev)
                prev.next = cloned;
            else
                ret.#entries = cloned;
            prev = cloned;
        }
        return ret;
    }

    public "get"(key: K, eq: EqualFn<K>): V|undefined {
        for (let cell = this.#entries; cell; cell = cell.next) {
            if (eq(cell.value[0], key))
                return cell.value[1];
        }
        return undefined;
    }

    public has(key: K, eq: EqualFn<K>): boolean {
        for (let cell = this.#entries; cell; cell = cell.next) {
            if (eq(cell.value[0], key))
                return true;
        }
        return false;
    }

    /** Return `true` iff the size of the bucket increased. */
    public "set"(key: K, value: V, eq: EqualFn<K>, combineFn?: CombineFn<K, V>): boolean {
        for (let cell = this.#entries; cell; cell = cell.next) {
            if (eq(cell.value[0], key)) {
                if (combineFn)
                    cell.value[1] = combineFn(cell.value[1], value, cell.value[0]);
                else
                    cell.value[1] = value;
                return false;
            }
        }
        this.#entries = {value: [key, value], next: this.#entries};
        return true;
    }

    /** Return `true` iff the key was present. */
    public "delete"(key: K, eq: EqualFn<K>): boolean {
        for (let cell = this.#entries, prev = null; cell; prev = cell, cell = cell.next) {
            if (eq(cell.value[0], key)) {
                if (prev)
                    prev.next = cell.next;
                else
                    this.#entries = cell.next;
                return true;
            }
        }
        return false;
    }

    public deleteAny(): [K, V]|undefined {
        if (this.#entries) {
            const pair = this.#entries.value;
            this.#entries = this.#entries.next;
            return pair;
        }
        return undefined;
    }

    public *[Symbol.iterator](): IterableIterator<[K, V]> {
        for (let cell = this.#entries; cell; cell = cell.next) {
            yield cell.value;
        }
    }

    public *keys(): IterableIterator<K> {
        for (let cell = this.#entries; cell; cell = cell.next) {
            yield cell.value[0];
        }
    }

    public *values(): IterableIterator<V> {
        for (let cell = this.#entries; cell; cell = cell.next) {
            yield cell.value[1];
        }
    }
}
