import { ReversibleIterable, ReversibleIterableIterator, reversible } from "./iterable.js";
import { Queue } from "./queue.js";
import { CompareFn, OrdSet } from "./ordered-set.js";
import * as S from "./ordered-set.js";

/** Used when combining old and new values for the same key.
 */
export type CombineFn<K, V> = (oldValue: V, newValue: V, key: K) => V;

/** Used when updating an old value for a given key.
 */
export type AdjustFn<K, V> = (oldValue: V, key: K) => V;

/** Used when updating or potentially deleting an old value for a given
 * key.
 */
export type UpdateFn<K, V> = (oldValue: V, key: K) => V|undefined;

/** Used when altering the existence of an element.
*/
export type AlterFn<K, V> = (oldValue: V|undefined, key: K) => V|undefined;

/** Used when mapping a function over values.
 */
export type MapFn<K, V, V2> = (value: V, key: K) => V2|undefined;

/** Ordered finite map, similar to the built-in `Map` but is ordered. The
 * type `K` can be anything while the type `V` may not be inhabited by
 * `undefined`. Any attempts on inserting `undefined` as a value will
 * result in a `TypeError`. The implementation is mostly a port of
 * `Data.Map` from https://hackage.haskell.org/package/containers
 */
export class OrdMap<K, V> implements ReversibleIterable<[K, V]> {
    // It's internally an immutable map in a mutable cell. Maybe it's
    // inefficient but is far, FAR easier to implement...
    readonly #cmp: CompareFn<K>;
    #root: Tree<K, V>;

    /** O(1). Create an empty map. If a comparing function is provided, the keys
     * will be compared using the function instead of the language built-in
     * comparison operators.
     */
    public constructor(compareFn?: CompareFn<K>);

    /** Create a map from an iterator of key/value pair. If the iterator
     * yields a sequence of strictly-ascending keys, a fast O(n) algorithm
     * is used. Otherwise it will fall back to a slow O(n log n)
     * algorithm.
     */
    public constructor(entries: Iterable<[K, V]>, compareFn?: CompareFn<K>);

    /** For internal use only. */
    public constructor(dummy: undefined, cmp: CompareFn<K>, root: Tree<K, V>);

    public constructor(...args: any[]) {
        switch (args.length) {
            case 0:
                this.#cmp  = defaultCmp<K>;
                this.#root = null;
                break;
            case 1:
                if (args[0] && typeof args[0] === "function") {
                    this.#cmp  = args[0];
                    this.#root = null;
                }
                else {
                    this.#cmp = defaultCmp<K>;

                    const pairs = Queue.from<[K, V]>(args[0]);
                    pairs.forEach(assertDefined);

                    this.#root = buildFrom(this.#cmp, pairs);
                }
                break;
            case 2:
                this.#cmp  = args[1] ?? defaultCmp<K>;

                const pairs = Queue.from<[K, V]>(args[0]);
                pairs.forEach(assertDefined);

                this.#root = buildFrom(this.#cmp, pairs);
                break;
            case 3:
                this.#cmp  = args[1];
                this.#root = args[2];
                break;
            default:
                throw new TypeError("Wrong number of arguments");
        }
    }

    /** O(1). The number of key/value pairs in the map. */
    public get size(): number {
        return size(this.#root);
    }

    /** O(log n). Lookup the value at a key in the map, or return
     * `undefined` if no corresponding value exists.
     */
    public "get"(key: K): V|undefined {
        return lookup(this.#cmp, key, this.#root);
    }

    /** O(log n). See if a key is in the map. */
    public has(key: K): boolean {
        return member(this.#cmp, key, this.#root);
    }

    /** O(log n). Find the largest key smaller than the given one and
     * return the corresponding `[key, value]` pair, or if no such key
     * exists return `undefined`.
     */
    public getLessThan(key: K): [K, V]|undefined {
        return lookupLT(this.#cmp, key, this.#root);
    }

    /** O(log n). Find the smallest key larger than the given one and
     * return the corresponding `[key, value]` pair, or if no such key
     * exists return `undefined`.
     */
    public getGreaterThan(key: K): [K, V]|undefined {
        return lookupGT(this.#cmp, key, this.#root);
    }

    /** O(log n). Find the largest key smaller than or equal to the given
     * one and return the corresponding `[key, value]` pair, or if no such
     * key exists return `undefined`.
     */
    public getLessThanEqual(key: K): [K, V]|undefined {
        return lookupLE(this.#cmp, key, this.#root);
    }

    /** O(log n). Find the smallest key larger than or equal to the given
     * one and return the corresponding `[key, value]` pair, or if no such
     * key exists return `undefined`.
     */
    public getGreaterThanEqual(key: K): [K, V]|undefined {
        return lookupGE(this.#cmp, key, this.#root);
    }

    /** O(1). Create a shallow copy of the map. The cloned map shares the
     * same keys, values, and the comparator function with the original
     * one.
     */
    public get clone(): OrdMap<K, V> {
        return new OrdMap(undefined, this.#cmp, this.#root);
    }

    /** O(log n). Insert a new key and a value in the map. If the key is
     * already present in the map, the associated value is replaced with
     * the supplied one.
     *
     * If a combining function is supplied, and there is an old value for
     * the same key, the method instead replaces the old value with
     * `combineFn(oldValue, newValue, newKey)`.
     */
    public "set"(key: K, value: V, combineFn?: CombineFn<K, V>): void {
        assertDefined(value);
        this.#root = insert(this.#cmp, key, value, this.#root, combineFn);
    }

    /** O(log n). Delete a key and its value from the map. Return `true`
     * iff the key was present.
     */
    public "delete"(key: K): boolean {
        const sz   = this.size;
        this.#root = delete_(this.#cmp, key, this.#root);
        return sz !== this.size;
    }

    /** O(m log n). Delete all keys in some container. If `keys` is an
     * `OrdSet<K>` it works faster than regular containers.
     */
    public deleteKeys(keys: Iterable<K>): void {
        if (keys instanceof OrdSet) {
            this.#root = withoutKeys(this.#cmp, this.#root, keys.root);
        }
        else {
            for (const key of keys) {
                this.#root = delete_(this.#cmp, key, this.#root);
            }
        }
    }

    /** O(m log n). Retain all keys in some container, and delete
     * everything else. If `keys` is an `OrdSet<K>` it works faster than
     * regular containers.
     */
    public restrictKeys(keys: Iterable<K>): void {
        if (keys instanceof OrdSet) {
            this.#root = restrictKeys(this.#cmp, this.#root, keys.root);
        }
        else {
            let oldRoot: Tree<K, V> = this.#root;
            let newRoot: Tree<K, V> = null;
            for (const key of keys) {
                const value = lookup(this.#cmp, key, oldRoot);
                if (value !== undefined) {
                    newRoot = insert(this.#cmp, key, value, newRoot);
                }
            }
            this.#root = newRoot;
        }
    }

    /** O(log n). Update a value at a specific key with the result of the
     * provided function. When the key isn't present in the map, nothing
     * will happen.
     */
    public adjust(key: K, adjustFn: AdjustFn<K, V>): void {
        function alterFn(oldValue: V|undefined, key: K): V|undefined {
            if (oldValue === undefined) {
                return undefined;
            }
            else {
                const adjusted = adjustFn(oldValue, key);
                assertDefined(adjusted);
                return adjusted;
            }
        }
        this.#root = alter(this.#cmp, alterFn, key, this.#root);
    }

    /** O(log n). Like {@link adjust}, but if the provided function returns
     * `undefined` the element is deleted.
     */
    public update(key: K, updateFn: UpdateFn<K, V>): void {
        function alterFn(oldValue: V|undefined, key: K): V|undefined {
            return oldValue === undefined
                ? undefined
                : updateFn(oldValue, key);
        }
        this.#root = alter(this.#cmp, alterFn, key, this.#root);
    }

    /** O(log n). Alter a value at a specific key, or its absence
     * thereof. This can be used to insert, delete, or update a value in an
     * `OrdMap`.
     */
    public alter(key: K, alterFn: AlterFn<K, V>): void {
        this.#root = alter(this.#cmp, alterFn, key, this.#root);
    }

    /** O(m log((n+1)/(m+1))), m ≦ n. Take the left-biased union of `this`
     * and `m`. The function returns a new map without modifying existing
     * ones.
     *
     * If a combining function is supplied, and duplicate keys are
     * encountered, the new value is obtained from `combineFn(valueFromArg,
     * valueFromThis, keyFromThis)`. Otherwise the values from `this` are
     * preferred.
     */
    public union(m: OrdMap<K, V>, combineFn?: CombineFn<K, V>): OrdMap<K, V>;

    /** The union of many maps. */
    public union(ms: Iterable<OrdMap<K, V>>, combineFn?: CombineFn<K, V>): OrdMap<K, V>;

    public union(arg0: any, combineFn?: CombineFn<K, V>): OrdMap<K, V> {
        if (arg0 instanceof OrdMap) {
            const tree = union(this.#cmp, this.#root, arg0.#root, combineFn);
            return new OrdMap(undefined, this.#cmp, tree);
        }
        else {
            let tree: Tree<K, V> = this.#root;
            for (const m of arg0) {
                tree = union(this.#cmp, tree, m.#root, combineFn);
            }
            return new OrdMap(undefined, this.#cmp, tree);
        }
    }

    /** O(m log((n+1)/(m+1))), m ≦ n. Return a new map consisting of
     * elements of `this` not existing in the map `m`.
     */
    public difference(m: OrdMap<K, V>): OrdMap<K, V> {
        const tree = difference(this.#cmp, this.#root, m.#root);
        return new OrdMap(undefined, this.#cmp, tree);
    }

    /** O(m log((n+1)/(m+1))), m ≦ n. Return a new map consisting of
     * elements of `this` that are also existing in the map `m`.
     */
    public intersection(m: OrdMap<K, V>): OrdMap<K, V> {
        const tree = intersection(this.#cmp, this.#root, m.#root);
        return new OrdMap(undefined, this.#cmp, tree);
    }

    /** O(m log((n+1)/(m+1))), m ≦ n. Return `true` iff `this` and the map
     * `m` contain no common keys.
     */
    public disjoint(m: OrdMap<K, V>): boolean {
        return disjoint(this.#cmp, this.#root, m.#root);
    }

    /** O(n). Map a function over all values in the map, and return a new
     * map. If the function returns `undefined`, the element will be
     * removed from the result.
     */
    public map<V2>(mapFn: MapFn<K, V, V2>): OrdMap<K, V2> {
        const tree = map(mapFn, this.#root);
        return new OrdMap(undefined, this.#cmp, tree);
    }

    /** O(n). Fold the values in the map using the given right-associative
     * binary operator.
     */
    public foldr<Acc>(f: (value: V, acc: Acc, key: K) => Acc, acc0: Acc): Acc {
        return foldr(f, acc0, this.#root);
    }

    /** O(n). Fold the values in the map using the given left-associative
     * binary operator.
     */
    public foldl<Acc>(f: (acc: Acc, value: V, key: K) => Acc, acc0: Acc): Acc {
        return foldl(f, acc0, this.#root);
    }

    /** O(n). Return `true` iff there is at least one element that
     * satisfies the given predicate.
     */
    public any(p: (value: V, key: K) => boolean): boolean {
        return any(p, this.#root);
    }

    /** O(n). Return `true` iff there are no elements that don't satisfy
     * the given predicate.
     */
    public all(p: (value: V, key: K) => boolean): boolean {
        return all(p, this.#root);
    }

    /** O(n). Iterate over keys in ascending order.
     */
    public keys(): ReversibleIterableIterator<K> {
        return iterateAsc((k, _v) => k, this.#root);
    }

    /** O(n). Iterate over values in ascending order of their keys.
     */
    public values(): ReversibleIterableIterator<V> {
        return iterateAsc((_k, v) => v, this.#root);
    }

    /** O(n). Iterate over key/value pairs where the keys are in ascending
     * order.
     */
    public entries(): ReversibleIterableIterator<[K, V]> {
        return iterateAsc((k, v) => [k, v], this.#root);
    }

    /** O(n). This is identical to `.entries().reverse()`. */
    public reverse(): IterableIterator<[K, V]> {
        return this.entries().reverse();
    }

    /** O(n). This is identical to {@link entries}. */
    public [Symbol.iterator](): IterableIterator<[K, V]> {
        return this.entries();
    }

    /** O(n). The set of all keys of the map. */
    public keysSet(): OrdSet<K> {
        const tree = keysSet(this.#root);
        return new OrdSet(undefined, this.#cmp, tree);
    }

    /** O(n). Create a new map consisting of elements that satisfy the
     * given predicate.
     */
    public filter(predicate: (value: V, key: K) => boolean): OrdMap<K, V> {
        const tree = filter(predicate, this.#root);
        return new OrdMap(undefined, this.#cmp, tree);
    }

    /** O(n). Partition the map according to a predicate. The first map
     * contains elements that satisfy the predicate, and the second map
     * contains those that don't. The original map is unchanged.
     */
    public partition(predicate: (value: V, key: K) => boolean): [OrdMap<K, V>, OrdMap<K, V>] {
        const [t1, t2] = partition(predicate, this.#root);
        return [
            new OrdMap(undefined, this.#cmp, t1),
            new OrdMap(undefined, this.#cmp, t2)
        ];
    }

    /** O(log n). Split the map into two maps. The first map contains
     * elements whose key is smaller than the given one, and the second map
     * contains those that are larger. It also returns the value
     * corresponding to the key, or `undefined` if no such value exists.
     */
    public split(key: K): [OrdMap<K, V>, V|undefined, OrdMap<K, V>] {
        const [t1, v, t2] = split(this.#cmp, key, this.#root);
        return [
            new OrdMap(undefined, this.#cmp, t1),
            v,
            new OrdMap(undefined, this.#cmp, t2)
        ];
    }

    /** O(log n). Return the index of a key, which is its zero-based index
     * in the sequence sorted by keys. When the key isn't present in the
     * map, the method returns `undefined`.
     */
    public indexOf(key: K): number|undefined {
        return lookupIndex(this.#cmp, key, this.#root);
    }

    /** O(log n). Retrieve an element by its zero-based index in the
     * sequence sorted by keys. When the index is out of range, the method
     * returns `undefined`.
     */
    public elementAt(index: number): [K, V]|undefined {
        return elemAt(index, this.#root);
    }

    /** O(log n). Take a given number of entries in key order, beginning
     * with the smallest key. The original map is unchanged.
     */
    public take(n: number): OrdMap<K, V> {
        const tree = take(n, this.#root);
        return new OrdMap(undefined, this.#cmp, tree);
    }

    /** O(log n). Drop a given number of entries in key order, beginning
     * with the smallest key. The original map is unchanged.
     */
    public drop(n: number): OrdMap<K, V> {
        const tree = drop(n, this.#root);
        return new OrdMap(undefined, this.#cmp, tree);
    }

    /** O(log n). Split a map at the given index. The first map contains
     * the first `n` elements, and the second map contains the
     * remaining. The original map is unchanged.
     */
    public splitAt(i: number): [OrdMap<K, V>, OrdMap<K, V>] {
        const [t1, t2] = splitAt(i, this.#root);
        return [
            new OrdMap(undefined, this.#cmp, t1),
            new OrdMap(undefined, this.#cmp, t2)
        ];
    }

    /** O(log n). Update the element at the given index. Nothing happens if
     * the index is out or range.
     */
    public updateAt(i: number, updateFn: UpdateFn<K, V>): void {
        this.#root = updateAt(updateFn, i, this.#root);
    }

    /** O(log n). Delete the element at the given index. Nothing happens if
     * the index is out or range.
     */
    public deleteAt(i: number): void {
        this.#root = updateAt(() => undefined, i, this.#root);
    }

    /** O(log n). Retrieve the minimal element of the map, or `undefined`
     * if the map is empty.
     */
    public minimum(): [K, V]|undefined {
        return lookupMin(this.#root);
    }

    /** O(log n). Retrieve the maximal element of the map, or `undefined`
     * if the map is empty.
     */
    public maximum(): [K, V]|undefined {
        return lookupMax(this.#root);
    }

    /** O(log n). Delete the minimal key. Do nothing if the map is
     * empty.
     */
    public deleteMin(): void {
        this.#root = deleteMin(this.#root);
    }

    /** O(log n). Delete the maximal key. Do nothing if the map is
     * empty.
     */
    public deleteMax(): void {
        this.#root = deleteMax(this.#root);
    }

    /** O(log n). Retrieve the minimal element of the map, and the map
     * stripped off that element. Return `undefined` if the map is empty.
     */
    public minView(): [K, V, OrdMap<K, V>]|undefined {
        const view = minView(this.#root);
        if (view) {
            const [k, v, rest] = view;
            return [k, v, new OrdMap(undefined, this.#cmp, rest)];
        }
        else {
            return undefined;
        }
    }

    /** O(log n). Retrieve the maximal element of the map, and the map
     * stripped off that element. Return `undefined` if the map is empty.
     */
    public maxView(): [K, V, OrdMap<K, V>]|undefined {
        const view = maxView(this.#root);
        if (view) {
            const [k, v, rest] = view;
            return [k, v, new OrdMap(undefined, this.#cmp, rest)];
        }
        else {
            return undefined;
        }
    }
}

type Tree<K, V> = null | Bin<K, V>;

interface Bin<K, V> {
    size:  number,
    key:   K,
    value: V,
    left:  Tree<K, V>;
    right: Tree<K, V>;
}

// The maximal relative difference between the size of two trees.
const DELTA = 3;
// The ratio between an outer and inner sibling of the heavier subtree in
// an unbalanced setting. It determines whether a double or single rotation
// should be performed to restore balance.
const RATIO = 2;

function defaultCmp<K>(a: K, b: K): -1|0|1 {
    return a === b ?  0
         : a  >  b ?  1
         :           -1;
};

function coerceOrd(r: number): -1|0|1 {
    return r === 0 ?  0
         : r  >  0 ?  1
         :           -1;
}

function assertDefined(v: any): void {
    if (v === undefined) {
        throw new TypeError("`undefined' is not a valid value of OrdMap");
    }
}

function size(t: Tree<any, any>): number {
    return t?.size ?? 0;
}

function lookup<K, V>(cmp: CompareFn<K>, key: K, tree: Tree<K, V>): V|undefined {
    while (true) {
        if (!tree) {
            return undefined;
        }
        else {
            switch (coerceOrd(cmp(key, tree.key))) {
                case -1: tree = tree.left;  break;
                case  1: tree = tree.right; break;
                case  0: return tree.value;
            }
        }
    }
}

function member<K, V>(cmp: CompareFn<K>, key: K, tree: Tree<K, V>): boolean {
    while (true) {
        if (!tree) {
            return false;
        }
        else {
            const {key: k, left: l, right: r} = tree;
            switch (coerceOrd(cmp(key, k))) {
                case -1: tree = l; break;
                case  1: tree = r; break;
                case  0: return true;
            }
        }
    }
}

function lookupLT<K, V>(cmp: CompareFn<K>, key: K, tree: Tree<K, V>): [K, V]|undefined {
    let best: Tree<K, V>|undefined = undefined;
    while (true) {
        if (!tree) {
            return best ? [best.key, best.value] : undefined;
        }
        else {
            if (cmp(key, tree.key) <= 0) {
                tree = tree.left;
            }
            else {
                best = tree;
                tree = tree.right;
            }
        }
    }
}

function lookupGT<K, V>(cmp: CompareFn<K>, key: K, tree: Tree<K, V>): [K, V]|undefined {
    let best: Tree<K, V>|undefined = undefined;
    while (true) {
        if (!tree) {
            return best ? [best.key, best.value] : undefined;
        }
        else {
            if (cmp(key, tree.key) < 0) {
                best = tree;
                tree = tree.left;
            }
            else {
                tree = tree.right;
            }
        }
    }
}

function lookupLE<K, V>(cmp: CompareFn<K>, key: K, tree: Tree<K, V>): [K, V]|undefined {
    let best: Tree<K, V>|undefined = undefined;
    while (true) {
        if (!tree) {
            return best ? [best.key, best.value] : undefined;
        }
        else {
            switch (coerceOrd(cmp(key, tree.key))) {
                case -1:
                    tree = tree.left;
                    break;
                case  0:
                    return [tree.key, tree.value];
                case  1:
                    best = tree;
                    tree = tree.right;
            }
        }
    }
}

function lookupGE<K, V>(cmp: CompareFn<K>, key: K, tree: Tree<K, V>): [K, V]|undefined {
    let best: Tree<K, V>|undefined = undefined;
    while (true) {
        if (!tree) {
            return best ? [best.key, best.value] : undefined;
        }
        else {
            switch (coerceOrd(cmp(key, tree.key))) {
                case -1:
                    best = tree;
                    tree = tree.left;
                    break;
                case  0:
                    return [tree.key, tree.value];
                case  1:
                    tree = tree.right;
            }
        }
    }
}

function insert<K, V>(cmp: CompareFn<K>, key: K, value: V, tree: Tree<K, V>, combineFn?: CombineFn<K, V>): Tree<K, V> {
    if (!tree) {
        return singleton(key, value);
    }
    else {
        const {key: k, value: v, left: l, right: r} = tree;
        switch (coerceOrd(cmp(key, k))) {
            case -1:
                // insert() may return an identical node. We can skip the
                // rebalancing if that's the case.
                const l1 = insert(cmp, key, value, l, combineFn);
                return l1 === l ? tree : balanceL(k, v, l1, r);
            case 1:
                const r1 = insert(cmp, key, value, r, combineFn);
                return r1 === r ? tree : balanceR(k, v, l, r1);
            case 0:
                // If the key/value pairs are pointer-equivalent, we can
                // reuse the same node. Note that we can't ignore the
                // pointer-equivalence of keys, because just because cmp()
                // tells us they are the same doesn't necessarily mean they
                // are identical and interchangeable.
                const combined = combineFn ? combineFn(v, value, key) : value;
                return (key === k && combined === v)
                    ? tree
                    : {...tree, key, value: combined};
        }
    }
}

// This is like insert() but does nothing if the key is already present in
// the tree. When a combining function is provided, it will be applied with
// arguments flipped, i.e. combineFn(newValue, oldValue, oldKey).
function insertR<K, V>(cmp: CompareFn<K>, key: K, value: V, tree: Tree<K, V>, combineFn?: CombineFn<K, V>): Tree<K, V> {
    if (!tree) {
        return singleton(key, value);
    }
    else {
        const {key: k, value: v, left: l, right: r} = tree;
        switch (coerceOrd(cmp(key, k))) {
            case -1:
                const l1 = insertR(cmp, key, value, l, combineFn);
                return l1 === l ? tree : balanceL(k, v, l1, r);
            case 1:
                const r1 = insertR(cmp, key, value, r, combineFn);
                return r1 === r ? tree : balanceR(k, v, l, r1);
            case 0:
                const combined = combineFn ? combineFn(value, v, k) : v;
                return combined === v
                    ? tree
                    : {...tree, value: combined};
        }
    }
}

// Can't use the name "delete" because it's a reserved word.
function delete_<K, V>(cmp: CompareFn<K>, key: K, tree: Tree<K, V>): Tree<K, V> {
    if (!tree) {
        return null;
    }
    else {
        const {key: k, value: v, left: l, right: r} = tree;
        switch (coerceOrd(cmp(key, k))) {
            case -1:
                // delete_() may return an identical node. We can skip the
                // rebalancing if that's the case.
                const l1 = delete_(cmp, key, l);
                return l1 === l ? tree : balanceR(k, v, l1, r);
            case 1:
                const r1 = delete_(cmp, key, r);
                return r1 === r ? tree : balanceL(k, v, l, r1);
            case 0:
                return glue(l, r);
        }
    }
}

function withoutKeys<K, V>(cmp: CompareFn<K>, m: Tree<K, V>, keys: S.Tree<K>): Tree<K, V> {
    if (!m) {
        return null;
    }
    else if (!keys) {
        return m;
    }
    else {
        const {elem: k, left: kl, right: kr} = keys;
        const [ml, mv, mr] = split(cmp, k, m);
        const ml1          = withoutKeys(cmp, ml, kl);
        const mr1          = withoutKeys(cmp, mr, kr);
        return (mv === undefined && ml1 === ml && mr1 === mr)
            ? m
            : link2(ml1, mr1);
    }
}

function restrictKeys<K, V>(cmp: CompareFn<K>, m: Tree<K, V>, keys: S.Tree<K>): Tree<K, V> {
    if (!m) {
        return null;
    }
    else if (!keys) {
        return null;
    }
    else {
        const {key: k, value: v, left: ml, right: mr} = m;
        const [kl, kb, kr] = S.split(cmp, k, keys);
        const mlkl         = restrictKeys(cmp, ml, kl);
        const mrkr         = restrictKeys(cmp, mr, kr);
        if (kb) {
            return (mlkl === ml && mrkr === kr)
                ? m
                : link(k, v, mlkl, mrkr);
        }
        else {
            return link2(mlkl, mrkr);
        }
    }
}

function alter<K, V>(cmp: CompareFn<K>, f: AlterFn<K, V>, key: K, tree: Tree<K, V>): Tree<K, V> {
    if (!tree) {
        const altered = f(undefined, key);
        return altered !== undefined
            ? singleton(key, altered)
            : null;
    }
    else {
        const {key: k, value: v, left: l, right: r} = tree;
        switch (coerceOrd(cmp(key, k))) {
            case -1:
                // alter() may return an identical node. We can skip the
                // rebalancing if that's the case.
                const l1 = alter(cmp, f, key, l);
                return l1 === l ? tree : balance(k, v, l1, r);
            case 1:
                const r1 = alter(cmp, f, key, r);
                return r1 === r ? tree : balance(k, v, l, r1);
            case 0:
                // The altering function may decide not to change the
                // value. We can reuse the node if that's the case.
                const altered = f(v, k);
                if (altered !== undefined)
                    return altered === v ? tree : {...tree, value: altered};
                else
                    return glue(l, r);
        }
    }
}

function union<K, V>(cmp: CompareFn<K>, t1: Tree<K, V>, t2: Tree<K, V>, combineFn?: CombineFn<K, V>): Tree<K, V> {
    if (!t2) {
        return t1;
    }
    else if (!t2.left && !t2.right) {
        return insertR(cmp, t2.key, t2.value, t1, combineFn);
    }
    else if (!t1) {
        return t2;
    }
    else if (!t1.left && !t1.right) {
        return insert(cmp, t1.key, t1.value, t2, combineFn);
    }
    else {
        const {key: k1, value: v1, left: l1, right: r1} = t1;
        const [l2, v2, r2] = split(cmp, k1, t2);
        const l1l2         = union(cmp, l1, l2, combineFn);
        const r1r2         = union(cmp, r1, r2, combineFn);
        const combined     = (v2 === undefined || !combineFn) ? v1 : combineFn(v1, v2, k1);
        return (combined == v1 && l1l2 === l1 && r1r2 === r1)
            ? t1
            : link(k1, combined, l1l2, r1r2);
    }
}

function difference<K, V>(cmp: CompareFn<K>, t1: Tree<K, V>, t2: Tree<K, V>): Tree<K, V> {
    if (!t1) {
        return null;
    }
    else if (!t2) {
        return t1;
    }
    else {
        const {key: k2, left: l2, right: r2} = t2;
        const [l1, _, r1] = split(cmp, k2, t1);
        const l1l2        = difference(cmp, l1, l2);
        const r1r2        = difference(cmp, r1, r2);
        return size(l1l2) + size(r1r2) === size(r1)
            ? t1
            : link2(l1l2, r1r2);
    }
}

function intersection<K, V>(cmp: CompareFn<K>, t1: Tree<K, V>, t2: Tree<K, V>): Tree<K, V> {
    if (!t1 || !t2) {
        return null;
    }
    else {
        const {key: k1, value: v1, left: l1, right: r1} = t1;
        const [l2, v2, r2] = split(cmp, k1, t2);
        const l1l2         = intersection(cmp, l1, l2);
        const r1r2         = intersection(cmp, r1, r2);
        if (v2 !== undefined)
            return l1l2 === l1 && r1r2 === r1
                ? t1
                : link(k1, v1, l1l2, r1r2);
        else
            return link2(l1l2, r1r2);
    }
}

function disjoint<K, V>(cmp: CompareFn<K>, t1: Tree<K, V>, t2: Tree<K, V>): boolean {
    if (!t1 || !t2) {
        return true;
    }
    else {
        const {size: s1, key: k1, left: l1, right: r1} = t1;
        if (s1 === 1) {
            return !member(cmp, k1, t2);
        }
        else {
            const [l2, v2, r2] = split(cmp, k1, t2);
            return v2 === undefined && disjoint(cmp, l1, l2) && disjoint(cmp, r1, r2);
        }
    }
}

function map<K, A, B>(f: MapFn<K, A, B>, tree: Tree<K, A>): Tree<K, B> {
    if (!tree) {
        return null;
    }
    else {
        const {key: k, value: v, left: l, right: r} = tree;
        const mapped = f(v, k);
        const l1 = map(f, l);
        const r1 = map(f, r);
        return mapped !== undefined
            ? link(k, mapped, l1, r1)
            : link2(l1, r1);
    }
}

function foldr<K, V, Acc>(f: (v: V, acc: Acc, k: K) => Acc, acc0: Acc, tree: Tree<K, V>): Acc {
    if (!tree)
        return acc0;
    else
        return foldr(f, f(tree.value, foldr(f, acc0, tree.right), tree.key), tree.left);
}

function foldl<K, V, Acc>(f: (acc: Acc, v: V, k: K) => Acc, acc0: Acc, tree: Tree<K, V>): Acc {
    if (!tree)
        return acc0;
    else
        return foldl(f, f(foldl(f, acc0, tree.left), tree.value, tree.key), tree.right);
}

function any<K, V>(p: (v: V, k: K) => boolean, tree: Tree<K, V>): boolean {
    return !tree                   ? false
         : p(tree.value, tree.key) ? true
         :                           (any(p, tree.left) || any(p, tree.right));
}

function all<K, V>(p: (v: V, k: K) => boolean, tree: Tree<K, V>): boolean {
    return !tree                    ? true
         : !p(tree.value, tree.key) ? false
         :                            (all(p, tree.left) && all(p, tree.right));
}

function iterateAsc<K, V, R>(f: (k: K, v: V) => R, tree: Tree<K, V>): ReversibleIterableIterator<R> {
    function *goAsc(tree: Tree<K, V>): IterableIterator<R> {
        if (tree) {
            yield* goAsc(tree.left);
            yield  f(tree.key, tree.value);
            yield* goAsc(tree.right);
        }
    }
    function *goDesc(tree: Tree<K, V>): IterableIterator<R> {
        if (tree) {
            yield* goDesc(tree.right);
            yield  f(tree.key, tree.value);
            yield* goDesc(tree.left);
        }
    }
    return reversible(goAsc(tree), () => goDesc(tree));
}

function keysSet<K>(tree: Tree<K, any>): S.Tree<K> {
    if (!tree) {
        return null;
    }
    else {
        return S.bin(tree.size, tree.key, keysSet(tree.left), keysSet(tree.right));
    }
}

function filter<K, V>(p: (v: V, k: K) => boolean, tree: Tree<K, V>): Tree<K, V> {
    if (!tree) {
        return null;
    }
    else {
        const {key: k, value: v, left: l, right: r} = tree;
        if (p(v, k)) {
            const l1 = filter(p, l);
            const r1 = filter(p, r);
            return l1 === l && r1 === r
                ? tree
                : link(k, v, l1, r1);
        }
        else {
            return link2(l, r);
        }
    }
}

function partition<K, V>(p: (v: V, k: K) => boolean, tree: Tree<K, V>): [Tree<K, V>, Tree<K, V>] {
    if (!tree) {
        return [null, null];
    }
    else {
        const {key: k, value: v, left: l, right: r} = tree;
        const [l1, l2] = partition(p, l);
        const [r1, r2] = partition(p, r);
        if (p(v, k))
            return [
                l1 === l && r1 === r
                    ? tree
                    : link(k, v, l1, r1),
                link2(l2, r2)
            ];
        else
            return [
                link2(l1, r1),
                l2 === l && r2 === r
                    ? tree
                    : link(k, v, l2, r2)
            ];
    }
}

function split<K, V>(cmp: CompareFn<K>, key: K, tree: Tree<K, V>): [Tree<K, V>, V|undefined, Tree<K, V>] {
    if (!tree) {
        return [null, undefined, null];
    }
    else {
        const {key: k, value: v, left: l, right: r} = tree;
        switch (coerceOrd(cmp(key, k))) {
            case -1: {
                const [ll, lv, lr] = split(cmp, key, l);
                return [ll, lv, link(k, v, lr, r)];
            }
            case  1: {
                const [rl, rv, rr] = split(cmp, key, r)
                return [link(k, v, l, rl), rv, rr];
            }
            case  0:
                return [l, v, r];
        }
    }
}

function lookupIndex<K, V>(cmp: CompareFn<K>, key: K, tree: Tree<K, V>): number|undefined {
    let idx = 0;
    while (true) {
        if (!tree) {
            return undefined;
        }
        else {
            const {key: k, left: l, right: r} = tree;
            switch (coerceOrd(cmp(key, k))) {
                case -1:
                    tree = l;
                    break;
                case  1:
                    idx += size(l) + 1;
                    tree = r;
                    break;
                case  0:
                    return idx + size(l);
            }
        }
    }
}

function elemAt<K, V>(idx: number, tree: Tree<K, V>): [K, V]|undefined {
    while (true) {
        if (!tree) {
            return undefined;
        }
        else {
            const {key: k, value: v, left: l, right: r} = tree;
            const ls = size(l);
            if (idx < ls) {
                tree = l;
            }
            else if (idx > ls) {
                idx -= ls + 1;
                tree = r;
            }
            else {
                return [k, v];
            }
        }
    }
}

function updateAt<K, V>(f: UpdateFn<K, V>, idx: number, tree: Tree<K, V>): Tree<K, V> {
    if (!tree) {
        return null;
    }
    else {
        const {key: k, value: v, left: l, right: r} = tree;
        const ls = size(l);
        if (idx < ls) {
            // updateAt() may return an identical node. We can skip the
            // rebalancing if that's the case.
            const l1 = updateAt(f, idx, l);
            return l1 === l ? tree : balanceR(k, v, l1, r);
        }
        else if (idx > ls) {
            const r1 = updateAt(f, idx-ls-1, r);
            return r1 === r ? tree : balanceL(k, v, l, r1);
        }
        else {
            // The updator function may decide not to change the value. We
            // can reuse the node if that's the case.
            const updated = f(v, k);
            if (updated !== undefined)
                return updated === v ? tree : {...tree, value: updated};
            else
                return glue(l, r);
        }
    }
}

function take<K, V>(n: number, tree: Tree<K, V>): Tree<K, V> {
    if (n >= size(tree)) {
        return tree;
    }
    else if (n <= 0) {
        return null;
    }
    else if (!tree) {
        return null;
    }
    else {
        const {key: k, value: v, left: l, right: r} = tree;
        const ls = size(l);
        if (n < ls)
            return take(n, l);
        else if (n > ls)
            return link(k, v, l, take(n - ls - 1, r));
        else
            return l;
    }
}

function drop<K, V>(n: number, tree: Tree<K, V>): Tree<K, V> {
    if (n >= size(tree)) {
        return null;
    }
    else if (n <= 0) {
        return tree;
    }
    else if (!tree) {
        return null;
    }
    else {
        const {key: k, value: v, left: l, right: r} = tree;
        const ls = size(l);
        if (n < ls)
            return link(k, v, drop(n, l), r);
        else if (n > ls)
            return drop(n - ls - 1, r);
        else
            return insertMin(k, v, r);
    }
}

function splitAt<K, V>(i: number, tree: Tree<K, V>): [Tree<K, V>, Tree<K, V>] {
    if (i >= size(tree)) {
        return [tree, null];
    }
    else if (i <= 0) {
        return [null, tree];
    }
    else if (!tree) {
        return [null, null];
    }
    else {
        const {key: k, value: v, left: l, right: r} = tree;
        const ls = size(l);
        if (i < ls) {
            const [ll, lr] = splitAt(i, l);
            return [ll, link(k, v, lr, r)];
        }
        else if (i > ls) {
            const [rl, rr] = splitAt(i - ls - 1, r);
            return [link(k, v, l, rl), rr];
        }
        else {
            return [l, insertMin(k, v, r)];
        }
    }
}

function lookupMin<K, V>(tree: Tree<K, V>): [K, V]|undefined {
    if (!tree) {
        return undefined;
    }
    else {
        if (!tree.left)
            return [tree.key, tree.value];
        else
            return lookupMin(tree.left);
    }
}

function lookupMax<K, V>(tree: Tree<K, V>): [K, V]|undefined {
    if (!tree) {
        return undefined;
    }
    else {
        if (!tree.right)
            return [tree.key, tree.value];
        else
            return lookupMax(tree.right);
    }
}

function deleteMin<K, V>(tree: Tree<K, V>): Tree<K, V> {
    if (!tree) {
        return tree;
    }
    else {
        if (!tree.left)
            return tree.right;
        else
            return balanceR(tree.key, tree.value, deleteMin(tree.left), tree.right);
    }
}

function deleteMax<K, V>(tree: Tree<K, V>): Tree<K, V> {
    if (!tree) {
        return tree;
    }
    else {
        if (!tree.right)
            return tree.left;
        else
            return balanceL(tree.key, tree.value, tree.left, deleteMax(tree.right));
    }
}

function minView<K, V>(tree: Tree<K, V>): [K, V, Tree<K, V>]|undefined;
function minView<K, V>(bin: Bin<K, V>): [K, V, Tree<K, V>];
function minView(arg: any) {
    if (!arg) {
        return undefined;
    }
    else {
        if (!arg.left) {
            return [arg.key, arg.value, arg.right];
        }
        else {
            const [mk, mv, left1] = minView(arg.left)!;
            return [mk, mv, balanceR(arg.key, arg.value, left1, arg.right)];
        }
    }
}

function maxView<K, V>(tree: Tree<K, V>): [K, V, Tree<K, V>]|undefined;
function maxView<K, V>(bin: Bin<K, V>): [K, V, Tree<K, V>];
function maxView(arg: any) {
    if (!arg) {
        return undefined;
    }
    else if (!arg.right) {
        return [arg.key, arg.value, arg.left];
    }
    else {
        const [mk, mv, right1] = maxView(arg.right)!;
        return [mk, mv, balanceL(arg.key, arg.value, arg.left, right1)];
    }
}

// Construct a singleton tree with a key/value pair. */
function singleton<K, V>(key: K, value: V): Tree<K, V> {
    return {size: 1, key, value, left: null, right: null};
}

// Construct a tree with all the components explicitly specified. The tree
// is assumed to be balanced.
function bin<K, V>(size: number, key: K, value: V, left: Tree<K, V>, right: Tree<K, V>): Tree<K, V>;

// Construct a tree with everything but size. The tree is assumed to be
// balanced.
function bin<K, V>(key: K, value: V, left: Tree<K, V>, right: Tree<K, V>): Tree<K, V>;

function bin<K, V>(...args: any[]): Tree<K, V> {
    switch (args.length) {
        case 5:
            return {size: args[0], key: args[1], value: args[2], left: args[3], right: args[4]};
        case 4:
            return {
                size:  size(args[2]) + size(args[3]) + 1,
                key:   args[0],
                value: args[1],
                left:  args[2],
                right: args[3]
            };
        default:
            throw new TypeError("Wrong number of arguments");
    }
}

// Construct a tree with a key/value pair, the left subtree, and the right
// subtree. Subtrees need not be balanced at all, but must not already
// contain the pair.
function link<K, V>(k: K, v: V, l: Tree<K, V>, r: Tree<K, V>): Tree<K, V> {
    if (!l) {
        return insertMin(k, v, r);
    }
    else if (!r) {
        return insertMax(k, v, l);
    }
    else {
        const {size: ls, key: lk, value: lv, left: ll, right: lr} = l;
        const {size: rs, key: rk, value: rv, left: rl, right: rr} = r;
        if (DELTA*ls < rs)
            return balanceL(rk, rv, link(k, v, l, rl), rr);
        else if (DELTA*rs < ls)
            return balanceL(lk, lv, ll, link(k, v, lr, r));
        else
            return bin(k, v, l, r);
    }
}

// Merge two trees and restore the balance.
function link2<K, V>(l: Tree<K, V>, r: Tree<K, V>): Tree<K, V> {
    if (!l) {
        return r;
    }
    else if (!r) {
        return l;
    }
    else {
        const {size: ls, key: lk, value: lv, left: ll, right: lr} = l;
        const {size: rs, key: rk, value: rv, left: rl, right: rr} = r;
        if (DELTA*ls < rs)
            return balanceL(rk, rv, link2(l, rl), rr);
        else if (DELTA*rs < ls)
            return balanceL(lk, lv, ll, link2(lr, r));
        else
            return glue(l, r);
    }
}

// Glue two trees together, assuming they both are already balanced with
// respect to each other.
function glue<K, V>(l: Tree<K, V>, r: Tree<K, V>) {
    if (!l) {
        return r;
    }
    else if (!r) {
        return l;
    }
    else {
        if (l.size > r.size) {
            const [mk, mv, l1] = maxView(l)!;
            return balanceR(mk, mv, l1, r);
        }
        else {
            const [mk, mv, r1] = minView(r)!;
            return balanceL(mk, mv, l, r1);
        }
    }
}

// Insert a new key, assuming no existing keys in the map are as small as
// the given one. This invariant is not checked.
function insertMin<K, V>(key: K, value: V, tree: Tree<K, V>): Tree<K, V> {
    if (!tree) {
        return singleton(key, value);
    }
    else {
        return balanceL(
            tree.key, tree.value,
            insertMin(key, value, tree.left), tree.right);
    }
}

// Insert a new key, assuming no existing keys in the map are as large as
// the given one. This invariant is not checked.
function insertMax<K, V>(key: K, value: V, tree: Tree<K, V>): Tree<K, V> {
    if (!tree) {
        return singleton(key, value);
    }
    else {
        return balanceR(
            tree.key, tree.value,
            tree.left, insertMax(key, value, tree.right));
    }
}

// Restore the balance and size, assuming the original tree was balanced
// and that `left` and `right` has changed by at most one element.
function balance<K, V>(k: K, v: V, l: Tree<K, V>, r: Tree<K, V>): Tree<K, V> {
    if (!l) {
        if (!r) {
            return singleton(k, v);
        }
        else {
            const {size: rs, key: rk, value: rv, left: rl, right: rr} = r;
            if (!rl) {
                if (!rr)
                    return bin(2, k, v, null, r);
                else
                    return bin(3, rk, rv, singleton(k, v), rr);
            }
            else {
                const {size: rls, key: rlk, value: rlv, left: rll, right: rlr} = rl;
                if (!rr) {
                    return bin(3, rlk, rlv, singleton(k, v), singleton(rk, rv));
                }
                else {
                    const {size: rrs} = rr;
                    if (rls < RATIO*rrs)
                        return bin(1+rs, rk, rv,
                                   bin(1+rls, k, v, null, rl), rr);
                    else
                        return bin(1+rs, rlk, rlv,
                                   bin(1+size(rll), k, v, null, rll),
                                   bin(1+rrs+size(rlr), rk, rv, rlr, rr));
                }
            }
        }
    }
    else {
        const {size: ls, key: lk, value: lv, left: ll, right: lr} = l;
        if (!r) {
            if (!ll) {
                if (!lr) {
                    return bin(2, k, v, l, null);
                }
                else {
                    const {key: lrk, value: lrv} = lr;
                    return bin(3, lrk, lrv, singleton(lk, lv), singleton(k, v));
                }
            }
            else {
                if (!lr) {
                    return bin(3, lk, lv, ll, singleton(k, v));
                }
                else {
                    const {size: lls} = ll;
                    const {size: lrs, key: lrk, value: lrv, left: lrl, right: lrr} = lr;
                    if (lrs < RATIO*lls)
                        return bin(1+ls, lk, lv, ll,
                                   bin(1+lrs, k, v, lr, null));
                    else
                        return bin(1+ls, lrk, lrv,
                                   bin(1+lls+size(lrl), lk, lv, ll, lrl),
                                   bin(1+size(lrr), k, v, lrr, null));
                }
            }
        }
        else {
            const {size: rs, key: rk, value: rv, left: rl, right: rr} = r;
            if (rs > DELTA*ls) {
                if (!rl || !rr) {
                    throw new Error("invalid tree");
                }
                const {size: rls, key: rlk, value: rlv, left: rll, right: rlr} = rl;
                const {size: rrs} = rr;
                if (rls < RATIO*rrs)
                    return bin(1+ls+rs, rk, rv,
                               bin(1+ls+rls, k, v, l, rl), rr);
                else
                    return bin(1+ls+rs, rlk, rlv,
                               bin(1+ls+size(rll), k, v, l, rll),
                               bin(1+rrs+size(rlr), rk, rv, rlr, rr));
            }
            else if (ls > DELTA*rs) {
                if (!ll || !lr) {
                    throw new Error("invalid tree");
                }
                const {size: lls} = ll;
                const {size: lrs, key: lrk, value: lrv, left: lrl, right: lrr} = lr;
                if (lrs < RATIO*lls)
                    return bin(1+ls+rs, lk, lv, ll,
                               bin(1+rs+lrs, k, v, lr, r));
                else
                    return bin(1+ls+rs, lrk, lrv,
                               bin(1+lls+size(lrl), lk, lv, ll, lrl),
                               bin(1+rs+size(lrr), k, v, lrr, r));
            }
            else {
                return bin(1+ls+rs, k, v, l, r);
            }
        }
    }
}

// balanceL() only checks if the left subtree is too big. Used when the left
// subtree might have been inserted to or when the right subtree might have
// been deleted from.
function balanceL<K, V>(k: K, v: V, l: Tree<K, V>, r: Tree<K, V>): Tree<K, V> {
    if (!r) {
        if (!l) {
            return singleton(k, v);
        }
        else {
            const {size: ls, key: lk, value: lv, left: ll, right: lr} = l;
            if (!ll) {
                if (!lr) {
                    return bin(2, k, v, l, null);
                }
                else {
                    const {key: lrk, value: lrv} = lr;
                    return bin(3, lrk, lrv, singleton(lk, lv), singleton(k, v));
                }
            }
            else {
                if (!lr) {
                    return bin(3, lk, lv, ll, singleton(k, v));
                }
                else {
                    const {size: lls} = ll;
                    const {size: lrs, key: lrk, value: lrv, left: lrl, right: lrr} = lr;
                    if (lrs < RATIO*lls)
                        return bin(1+ls, lk, lv, ll, bin(1+lrs, k, v, lr, null));
                    else
                        return bin(1+ls, lrk, lrv,
                                   bin(1+lls+size(lrl), lk, lv, ll, lrl),
                                   bin(1+size(lrr), k, v, lrr, null));
                }
            }
        }
    }
    else {
        const {size: rs} = r;
        if (!l) {
            return bin(1+rs, k, v, null, r);
        }
        else {
            const {size: ls, key: lk, value: lv, left: ll, right: lr} = l;
            if (ls > DELTA*rs) {
                if (!ll || !lr) {
                    throw new Error("invalid tree");
                }
                const {size: lls} = ll;
                const {size: lrs, key: lrk, value: lrv, left: lrl, right: lrr} = lr;
                if (lrs < RATIO*lls)
                    return bin(1+ls+rs, lk, lv, ll,
                               bin(1+rs+lrs, k, v, lr, r));
                else
                    return bin(1+ls+rs, lrk, lrv,
                               bin(1+lls+size(lrl), lk, lv, ll, lrl),
                               bin(1+rs+size(lrr), k, v, lrr, r));
            }
            else {
                return bin(1+ls+rs, k, v, l, r);
            }
        }
    }
}

// balanceR() only checks if the right subtree is too big. Used when the
// right subtree might have been inserted to or when the left subtree might
// have been deleted from.
function balanceR<K, V>(k: K, v: V, l: Tree<K, V>, r: Tree<K, V>): Tree<K, V> {
    if (!l) {
        if (!r) {
            return singleton(k, v);
        }
        else {
            const {size: rs, key: rk, value: rv, left: rl, right: rr} = r;
            if (!rl) {
                if (!rr)
                    return bin(2, k, v, null, r);
                else
                    return bin(3, rk, rv, singleton(k, v), rr);
            }
            else {
                const {size: rls, key: rlk, value: rlv, left: rll, right: rlr} = rl;
                if (!rr) {
                    return bin(3, rlk, rlv, singleton(k, v), singleton(rk, rv));
                }
                else {
                    const {size: rrs} = rr;
                    if (rls < RATIO*rrs)
                        return bin(1+rs, rk, rv,
                                   bin(1+rls, k, v, null, rl), rr);
                    else
                        return bin(1+rs, rlk, rlv,
                                   bin(1+size(rll), k, v, null, rll),
                                   bin(1+rrs+size(rlr), rk, rv, rlr, rr));
                }
            }
        }
    }
    else {
        const {size: ls} = l;
        if (!r) {
            return bin(1 + ls, k, v, l, null);
        }
        else {
            const {size: rs, key: rk, value: rv, left: rl, right: rr} = r;
            if (rs > DELTA*ls) {
                if (!rl || !rr) {
                    throw new Error("invalid tree");
                }
                const {size: rls, key: rlk, value: rlv, left: rll, right: rlr} = rl;
                const {size: rrs} = rr;
                if (rls < RATIO*rrs)
                    return bin(1+ls+rs, rk, rv,
                               bin(1+ls+rls, k, v, l, rl), rr);
                else
                    return bin(1+ls+rs, rlk, rlv,
                               bin(1+ls+size(rll), k, v, l, rll),
                               bin(1+rrs+size(rlr), rk, rv, rlr, rr));
            }
            else {
                return bin(1+ls+rs, k, v, l, r);
            }
        }
    }
}

// Take a queue of key/value pairs and build a tree from it. The reason why
// we don't take an iterator of pairs is that directly working with
// iterators is way too inconvenient.
function buildFrom<K, V>(cmp: CompareFn<K>, pairs: Queue<[K, V]>): Tree<K, V> {
    if (pairs.isEmpty) {
        // Empty imput -> empty tree
        return null;
    }

    const [fst, rest] = pairs.uncons();
    const tree        = singleton(fst[0], fst[1]);
    if (rest.isEmpty) {
        // Singleton input -> singleton tree
        return tree;
    }

    return !isOrdered(cmp, fst, rest)
        ? buildFromUnordered(cmp, tree, rest)
        : buildFromOrdered(cmp, 1, tree, rest);
}

function isOrdered<K, V>(cmp: CompareFn<K>, fst: [K, V], rest: Queue<[K, V]>): boolean {
    return rest.isEmpty
        ? true // No more pairs to compare.
        : cmp(fst[0], rest.head[0]) < 0;
}

// O(n log n) way of building a tree from an unordered queue. Always usable.
function buildFromUnordered<K, V>(cmp: CompareFn<K>, tree: Tree<K, V>, pairs: Queue<[K, V]>): Tree<K, V> {
    return pairs.foldl((t, [k, v]) => insert(cmp, k, v, t), tree);
}

// O(n) way of building a tree from a strictly-ascending queue.
function buildFromOrdered<K, V>(cmp: CompareFn<K>, height: number, tree: Tree<K, V>, pairs: Queue<[K, V]>): Tree<K, V> {
    if (pairs.isEmpty) {
        // No more pairs to insert.
        return tree;
    }
    else {
        const [fst, rest] = pairs.uncons();
        if (rest.isEmpty) {
            // Just one pair to insert.
            return insertMax(fst[0], fst[1], tree);
        }
        else if (!isOrdered(cmp, fst, rest)) {
            // We have more than a single pair to insert, but the second
            // pair isn't strictly-ascending. Fall back to the O(n log n)
            // way.
            return buildFromUnordered(cmp, tree, pairs);
        }
        else {
            // We now have a tree of some non-zero height. It would be
            // awesome if we could build another tree of the same height,
            // and link them together with the element `fst`. But this is
            // only possible if the input is ordered. We know `fst` is
            // greater than every key in `tree`.
            const [right, ordRest, unordRest] = buildSibling(cmp, height, rest);
            // Either ordRest or unordRest is non-empty. Never both.
            const left   = tree;
            const linked = link(fst[0], fst[1], left, right);
            return !ordRest.isEmpty
                ? buildFromOrdered(cmp, height+1, linked, ordRest)
                : buildFromUnordered(cmp, linked, unordRest);
        }
    }
}

function buildSibling<K, V>(cmp: CompareFn<K>, height: number, pairs: Queue<[K, V]>): [Tree<K, V>, Queue<[K, V]>, Queue<[K, V]>] {
    if (pairs.isEmpty) {
        return [null, Queue.empty, Queue.empty];
    }
    else {
        const [fst, rest] = pairs.uncons();
        if (height === 1) {
            const tree = singleton(fst[0], fst[1]);
            return !isOrdered(cmp, fst, rest)
                ? [tree, Queue.empty, rest]
                : [tree, rest, Queue.empty];
        }
        else {
            // Height of two or more: build two subtrees with one less
            // height.
            const sibling = buildSibling(cmp, height-1, pairs);
            const [left, ordRest, _] = sibling;

            if (ordRest.isEmpty) {
                // It's unordered. We must fall back to the O(n log n) way.
                return sibling;
            }
            else {
                const [ordFst, ordRest1] = ordRest.uncons();
                if (ordRest1.isEmpty) {
                    // It's ordered and we have the very last pair to
                    // insert.
                    return [insertMax(ordFst[0], ordFst[1], left), Queue.empty, Queue.empty];
                }
                else if (!isOrdered(cmp, ordFst, ordRest1)) {
                    // It was the last ordered pair. We know ordFst is
                    // ordered but we can't make use of the fact.
                    return [left, Queue.empty, ordRest];
                }
                else {
                    // Great... it's still ordered. Try building the right
                    // subtree.
                    const [right, ordRest2, unordRest2] = buildSibling(cmp, height-1, ordRest1);
                    return [link(ordFst[0], ordFst[1], left, right), ordRest2, unordRest2];
                    // Maybe we can use bin() instead of link() if left and
                    // right have the same size? Is that safe?
                }
            }
        }
    }
}
