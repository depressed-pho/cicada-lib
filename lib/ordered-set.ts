import { ReversibleIterable, ReversibleIterableIterator, reversible } from "./iterable.js";
import { Queue } from "./queue.js";

/** Positivity denotes `a` is greater than `b`.
 */
export type CompareFn<T> = (a: T, b: T) => number;

/** Ordered finite set, similar to the built-in `Set` but is ordered. The
 * type `T` may not be inhabited by `undefined`. Any attempts on inserting
 * `undefined` as an element will result in a `TypeError`. The
 * implementation is mostly a port of `Data.Set` from
 * https://hackage.haskell.org/package/containers
 */
export class OrdSet<T> implements ReversibleIterable<T> {
    // It's internally an immutable set in a mutable cell. Maybe it's
    // inefficient but is far, FAR easier to implement...
    readonly #cmp: CompareFn<T>;
    #root: Tree<T>;

    /** O(1). Create an empty set. If a comparing function is provided, the
     * elements will be compared using the function instead of the language
     * built-in comparison operators.
     */
    public constructor(compareFn?: CompareFn<T>);

    /** Create a set from an iterator of elements. If the iterator yields a
     * sequence of strictly-ascending elements, a fast O(n) algorithm is
     * used. Otherwise it will fall back to a slow O(n log n) algorithm.
     */
    public constructor(elements: Iterable<T>, compareFn?: CompareFn<T>);

    /** For internal use only. */
    public constructor(dummy: undefined, cmp: CompareFn<T>, root: Tree<T>);

    public constructor(...args: any[]) {
        switch (args.length) {
            case 0:
                this.#cmp  = defaultCmp<T>;
                this.#root = null;
                break;
            case 1:
                if (args[0] && typeof args[0] === "function") {
                    this.#cmp  = args[0];
                    this.#root = null;
                }
                else {
                    this.#cmp  = defaultCmp<T>;

                    const elems = Queue.from<T>(args[0]);
                    elems.forEach(assertDefined);

                    this.#root = buildFrom(this.#cmp, elems);
                }
                break;
            case 2:
                this.#cmp  = args[1] ?? defaultCmp<T>;

                const elems = Queue.from<T>(args[0]);
                elems.forEach(assertDefined);

                this.#root = buildFrom(this.#cmp, elems);
                break;
            case 3:
                this.#cmp  = args[1];
                this.#root = args[2];
                break;
            default:
                throw new TypeError("Wrong number of arguments");
        }
    }

    /** Package private: user code should not use this. */
    public get root(): Tree<T> {
        return this.#root;
    }

    /** O(1). The number of elemens in the set. */
    public get size(): number {
        return size(this.#root);
    }

    /** O(log n). See if an element is in the set. */
    public has(elem: T): boolean {
        return member(this.#cmp, elem, this.#root);
    }

    /** O(log n). Find the largest element smaller than the given one, or
     * if no such element exists return `undefined`.
     */
    public getLessThan(elem: T): T|undefined {
        return lookupLT(this.#cmp, elem, this.#root);
    }

    /** O(log n). Find the smallest element smaller than the given one, or
     * if no such element exists return `undefined`.
     */
    public getGreaterThan(elem: T): T|undefined {
        return lookupGT(this.#cmp, elem, this.#root);
    }

    /** O(log n). Find the largest element smaller than or equal to the
     * given one, or if no such element exists return `undefined`.
     */
    public getLessThanEqual(elem: T): T|undefined {
        return lookupLE(this.#cmp, elem, this.#root);
    }

    /** O(log n). Find the smallest element larger than or equal to the
     * given one, or if no such element exists return `undefined`.
     */
    public getGreaterThanEqual(elem: T): T|undefined {
        return lookupGE(this.#cmp, elem, this.#root);
    }

    /** O(1). Create a shallow copy of the set. The cloned set shares the
     * same elements and the comparator function with the original one.
     */
    public get clone(): OrdSet<T> {
        return new OrdSet(undefined, this.#cmp, this.#root);
    }

    /** O(log n). Insert a new element in the set. If the element is
     * already present in the set, it is replaced with the supplied one.
     */
    public add(elem: T): void {
        assertDefined(elem);
        this.#root = insert(this.#cmp, elem, this.#root);
    }

    /** O(log n). Delete an element from the set. Return `true` iff the
     * element was present.
     */
    public "delete"(elem: T): boolean {
        const sz   = this.size;
        this.#root = delete_(this.#cmp, elem, this.#root);
        return sz !== this.size;
    }

    /** O(m log((n+1)/(m+1))), m ≦ n. Take the left-biased union of `this`
     * and `s`. The function returns a new set without modifying existing
     * ones.
     */
    public union(s: OrdSet<T>): OrdSet<T>;

    /** The union of many sets. */
    public union(ss: Iterable<OrdSet<T>>): OrdSet<T>;

    public union(arg0: any): OrdSet<T> {
        if (arg0 instanceof OrdSet) {
            const tree = union(this.#cmp, this.#root, arg0.#root);
            return new OrdSet(undefined, this.#cmp, tree);
        }
        else {
            let tree: Tree<T> = this.#root;
            for (const s of arg0) {
                tree = union(this.#cmp, tree, s.#root);
            }
            return new OrdSet(undefined, this.#cmp, tree);
        }
    }

    /** O(m log((n+1)/(m+1))), m ≦ n. Return a new set consisting of
     * elements of `this` not existing in the set `s`.
     */
    public difference(s: OrdSet<T>): OrdSet<T> {
        const tree = difference(this.#cmp, this.#root, s.#root);
        return new OrdSet(undefined, this.#cmp, tree);
    }

    /** O(m log((n+1)/(m+1))), m ≦ n. Return a new set consisting of
     * elements of `this` that are also existing in the set `s`.
     */
    public intersection(s: OrdSet<T>): OrdSet<T> {
        const tree = intersection(this.#cmp, this.#root, s.#root);
        return new OrdSet(undefined, this.#cmp, tree);
    }

    /** O(m log((n+1)/(m+1))), m ≦ n. Return `true` iff `this` and the set
     * `s` contain no common elements.
     */
    public disjoint(s: OrdSet<T>): boolean {
        return disjoint(this.#cmp, this.#root, s.#root);
    }

    /** O(n). Fold the elements in the set using the given
     * right-associative binary operator.
     */
    public foldr<Acc>(f: (elem: T, acc: Acc) => Acc, acc0: Acc): Acc {
        return foldr(f, acc0, this.#root);
    }

    /** O(n). Fold the elements in the set using the given left-associative
     * binary operator.
     */
    public foldl<Acc>(f: (acc: Acc, elem: T) => Acc, acc0: Acc): Acc {
        return foldl(f, acc0, this.#root);
    }

    /** O(n). Return `true` iff there is at least one element that
     * satisfies the given predicate.
     */
    public any(p: (elem: T) => boolean): boolean {
        return any(p, this.#root);
    }

    /** O(n). Return `true` iff there are no elements that don't satisfy
     * the given predicate.
     */
    public all(p: (elem: T) => boolean): boolean {
        return all(p, this.#root);
    }

    /** O(n). Iterate over elements in ascending order.
     */
    public values(): ReversibleIterableIterator<T> {
        return iterateAsc(this.#root);
    }

    /** O(n). This is identical to `.entries().reverse()`. */
    public reverse(): IterableIterator<T> {
        return this.values().reverse();
    }

    /** O(n). This is identical to {@link values}. */
    public [Symbol.iterator](): IterableIterator<T> {
        return this.values();
    }

    /** O(n). Create a new set consisting of elements that satisfy the
     * given predicate.
     */
    public filter(predicate: (elem: T) => boolean): OrdSet<T> {
        const tree = filter(predicate, this.#root);
        return new OrdSet(undefined, this.#cmp, tree);
    }

    /** O(n). Partition the set according to a predicate. The first set
     * contains elements that satisfy the predicate, and the second set
     * contains those that don't. The original set is unchanged.
     */
    public partition(predicate: (elem: T) => boolean): [OrdSet<T>, OrdSet<T>] {
        const [t1, t2] = partition(predicate, this.#root);
        return [
            new OrdSet(undefined, this.#cmp, t1),
            new OrdSet(undefined, this.#cmp, t2)
        ];
    }

    /** O(log n). Split the set into two sets. The first set contains
     * elements which are smaller than the given one, and the second set
     * contains which are larger. It also returns a boolean value
     * indicating if the given element exists in the set.
     */
    public split(elem: T): [OrdSet<T>, boolean, OrdSet<T>] {
        const [t1, b, t2] = split(this.#cmp, elem, this.#root);
        return [
            new OrdSet(undefined, this.#cmp, t1),
            b,
            new OrdSet(undefined, this.#cmp, t2)
        ];
    }

    /** O(log n). Return the index of an element, which is its zero-based
     * index in the sorted sequence. When the element isn't present in the
     * set, the method returns `undefined`.
     */
    public indexOf(elem: T): number|undefined {
        return lookupIndex(this.#cmp, elem, this.#root);
    }

    /** O(log n). Retrieve an element by its zero-based index in the sorted
     * sequence. When the index is out of range, the method returns
     * `undefined`.
     */
    public elementAt(index: number): T|undefined {
        return elemAt(index, this.#root);
    }

    /** O(log n). Take a given number of elements in order, beginning with
     * the smallest one. The original set is unchanged.
     */
    public take(n: number): OrdSet<T> {
        const tree = take(n, this.#root);
        return new OrdSet(undefined, this.#cmp, tree);
    }

    /** O(log n). Drop a given number of elements in order, beginning with
     * the smallest one. The original set is unchanged.
     */
    public drop(n: number): OrdSet<T> {
        const tree = drop(n, this.#root);
        return new OrdSet(undefined, this.#cmp, tree);
    }

    /** O(log n). Split a set at the given index. The first set contains
     * the first `n` elements, and the second set contains the
     * remaining. The original set is unchanged.
     */
    public splitAt(i: number): [OrdSet<T>, OrdSet<T>] {
        const [t1, t2] = splitAt(i, this.#root);
        return [
            new OrdSet(undefined, this.#cmp, t1),
            new OrdSet(undefined, this.#cmp, t2)
        ];
    }

    /** O(log n). Delete the element at the given index. Nothing happens if
     * the index is out or range.
     */
    public deleteAt(i: number): void {
        this.#root = deleteAt(i, this.#root);
    }

    /** O(log n). Retrieve the minimal element of the set, or `undefined`
     * if the set is empty.
     */
    public minimum(): T|undefined {
        return lookupMin(this.#root);
    }

    /** O(log n). Retrieve the maximal element of the set, or `undefined`
     * if the set is empty.
     */
    public maximum(): T|undefined {
        return lookupMax(this.#root);
    }

    /** O(log n). Delete the minimal element. Do nothing if the set is
     * empty.
     */
    public deleteMin(): void {
        this.#root = deleteMin(this.#root);
    }

    /** O(log n). Delete the maximal element. Do nothing if the set is
     * empty.
     */
    public deleteMax(): void {
        this.#root = deleteMax(this.#root);
    }

    /** O(log n). Retrieve the minimal element of the set, and the set
     * stripped off that element. Return `undefined` if the set is empty.
     */
    public minView(): [T, OrdSet<T>]|undefined {
        const view = minView(this.#root);
        if (view) {
            const [elem, rest] = view;
            return [elem, new OrdSet(undefined, this.#cmp, rest)];
        }
        else {
            return undefined;
        }
    }

    /** O(log n). Retrieve the maximal element of the set, and the set
     * stripped off that element. Return `undefined` if the set is empty.
     */
    public maxView(): [T, OrdSet<T>]|undefined {
        const view = maxView(this.#root);
        if (view) {
            const [elem, rest] = view;
            return [elem, new OrdSet(undefined, this.#cmp, rest)];
        }
        else {
            return undefined;
        }
    }
}

// Package private: user code should not use this.
export type Tree<T> = null | Bin<T>;

// Package private: user code should not use this.
export interface Bin<T> {
    size:  number,
    elem:  T
    left:  Tree<T>;
    right: Tree<T>;
}

// The maximal relative difference between the size of two trees.
const DELTA = 3;
// The ratio between an outer and inner sibling of the heavier subtree in
// an unbalanced setting. It determines whether a double or single rotation
// should be performed to restore balance.
const RATIO = 2;

function defaultCmp<T>(a: T, b: T): -1|0|1 {
    return a === b ?  0
         : a  >  b ?  1
         :           -1;
};

function coerceOrd(r: number): -1|0|1 {
    return r === 0 ?  0
         : r  >  0 ?  1
         :           -1;
}

function assertDefined(elem: any): void {
    if (elem === undefined) {
        throw new TypeError("`undefined' is not a valid element of OrdSet");
    }
}

function size(t: Tree<any>): number {
    return t?.size ?? 0;
}

function member<T>(cmp: CompareFn<T>, elem: T, tree: Tree<T>): boolean {
    while (true) {
        if (!tree) {
            return false;
        }
        else {
            const {elem: e, left: l, right: r} = tree;
            switch (coerceOrd(cmp(elem, e))) {
                case -1: tree = l; break;
                case  1: tree = r; break;
                case  0: return true;
            }
        }
    }
}

function lookupLT<T>(cmp: CompareFn<T>, elem: T, tree: Tree<T>): T|undefined {
    let best: Tree<T>|undefined = undefined;
    while (true) {
        if (!tree) {
            return best?.elem;
        }
        else {
            if (cmp(elem, tree.elem) <= 0) {
                tree = tree.left;
            }
            else {
                best = tree;
                tree = tree.right;
            }
        }
    }
}

function lookupGT<T>(cmp: CompareFn<T>, elem: T, tree: Tree<T>): T|undefined {
    let best: Tree<T>|undefined = undefined;
    while (true) {
        if (!tree) {
            return best?.elem;
        }
        else {
            if (cmp(elem, tree.elem) < 0) {
                best = tree;
                tree = tree.left;
            }
            else {
                tree = tree.right;
            }
        }
    }
}

function lookupLE<T>(cmp: CompareFn<T>, elem: T, tree: Tree<T>): T|undefined {
    let best: Tree<T>|undefined = undefined;
    while (true) {
        if (!tree) {
            return best?.elem;
        }
        else {
            switch (coerceOrd(cmp(elem, tree.elem))) {
                case -1:
                    tree = tree.left;
                    break;
                case  0:
                    return tree.elem;
                case  1:
                    best = tree;
                    tree = tree.right;
            }
        }
    }
}

function lookupGE<T>(cmp: CompareFn<T>, elem: T, tree: Tree<T>): T|undefined {
    let best: Tree<T>|undefined = undefined;
    while (true) {
        if (!tree) {
            return best?.elem;
        }
        else {
            switch (coerceOrd(cmp(elem, tree.elem))) {
                case -1:
                    best = tree;
                    tree = tree.left;
                    break;
                case  0:
                    return tree.elem;
                case  1:
                    tree = tree.right;
            }
        }
    }
}

function insert<T>(cmp: CompareFn<T>, elem: T, tree: Tree<T>): Tree<T> {
    if (!tree) {
        return singleton(elem);
    }
    else {
        const {elem: e, left: l, right: r} = tree;
        switch (coerceOrd(cmp(elem, e))) {
            case -1:
                // insert() may return an identical node. We can skip the
                // rebalancing if that's the case.
                const l1 = insert(cmp, elem, l);
                return l1 === l ? tree : balanceL(e, l1, r);
            case 1:
                const r1 = insert(cmp, elem, r);
                return r1 === r ? tree : balanceR(e, l, r1);
            case 0:
                // If the elements are pointer-equivalent, we can reuse the
                // same node.
                return elem === e ? tree : {...tree, elem};
        }
    }
}

// This is like insert() but does nothing if the element is already present
// in the tree.
function insertR<T>(cmp: CompareFn<T>, elem: T, tree: Tree<T>): Tree<T> {
    if (!tree) {
        return singleton(elem);
    }
    else {
        const {elem: e, left: l, right: r} = tree;
        switch (coerceOrd(cmp(elem, e))) {
            case -1:
                const l1 = insertR(cmp, elem, l);
                return l1 === l ? tree : balanceL(e, l1, r);
            case 1:
                const r1 = insertR(cmp, elem, r);
                return r1 === r ? tree : balanceR(e, l, r1);
            case 0:
                return tree;
        }
    }
}

// Can't use the name "delete" because it's a reserved word.
function delete_<T>(cmp: CompareFn<T>, elem: T, tree: Tree<T>): Tree<T> {
    if (!tree) {
        return null;
    }
    else {
        const {elem: e, left: l, right: r} = tree;
        switch (coerceOrd(cmp(elem, e))) {
            case -1:
                // delete_() may return an identical node. We can skip the
                // rebalancing if that's the case.
                const l1 = delete_(cmp, elem, l);
                return l1 === l ? tree : balanceR(e, l1, r);
            case 1:
                const r1 = delete_(cmp, elem, r);
                return r1 === r ? tree : balanceL(e, l, r1);
            case 0:
                return glue(l, r);
        }
    }
}

function union<T>(cmp: CompareFn<T>, t1: Tree<T>, t2: Tree<T>): Tree<T> {
    if (!t2) {
        return t1;
    }
    else if (!t2.left && !t2.right) {
        return insertR(cmp, t2.elem, t1);
    }
    else if (!t1) {
        return t2;
    }
    else if (!t1.left && !t1.right) {
        return insert(cmp, t1.elem, t2);
    }
    else {
        const {elem: e1, left: l1, right: r1} = t1;
        const [l2, _, r2] = split(cmp, e1, t2);
        const l1l2        = union(cmp, l1, l2);
        const r1r2        = union(cmp, r1, r2);
        return (l1l2 === l1 && r1r2 === r1)
            ? t1
            : link(e1, l1l2, r1r2);
    }
}

function difference<T>(cmp: CompareFn<T>, t1: Tree<T>, t2: Tree<T>): Tree<T> {
    if (!t1) {
        return null;
    }
    else if (!t2) {
        return t1;
    }
    else {
        const {elem: e2, left: l2, right: r2} = t2;
        const [l1, _, r1] = split(cmp, e2, t1);
        const l1l2        = difference(cmp, l1, l2);
        const r1r2        = difference(cmp, r1, r2);
        return size(l1l2) + size(r1r2) === size(r1)
            ? t1
            : link2(l1l2, r1r2);
    }
}

function intersection<T>(cmp: CompareFn<T>, t1: Tree<T>, t2: Tree<T>): Tree<T> {
    if (!t1 || !t2) {
        return null;
    }
    else {
        const {elem: e1, left: l1, right: r1} = t1;
        const [l2, b2, r2] = split(cmp, e1, t2);
        const l1l2         = intersection(cmp, l1, l2);
        const r1r2         = intersection(cmp, r1, r2);
        if (b2)
            return l1l2 === l1 && r1r2 === r1
                ? t1
                : link(e1, l1l2, r1r2);
        else
            return link2(l1l2, r1r2);
    }
}

function disjoint<T>(cmp: CompareFn<T>, t1: Tree<T>, t2: Tree<T>): boolean {
    if (!t1 || !t2) {
        return true;
    }
    else {
        const {size: s1, elem: e1, left: l1, right: r1} = t1;
        if (s1 === 1) {
            return !member(cmp, e1, t2);
        }
        else {
            const [l2, b2, r2] = split(cmp, e1, t2);
            return !b2 && disjoint(cmp, l1, l2) && disjoint(cmp, r1, r2);
        }
    }
}

function foldr<T, Acc>(f: (elem: T, acc: Acc) => Acc, acc0: Acc, tree: Tree<T>): Acc {
    if (!tree)
        return acc0;
    else
        return foldr(f, f(tree.elem, foldr(f, acc0, tree.right)), tree.left);
}

function foldl<T, Acc>(f: (acc: Acc, elem: T) => Acc, acc0: Acc, tree: Tree<T>): Acc {
    if (!tree)
        return acc0;
    else
        return foldl(f, f(foldl(f, acc0, tree.left), tree.elem), tree.right);
}

function any<T>(p: (elem: T) => boolean, tree: Tree<T>): boolean {
    return !tree        ? false
         : p(tree.elem) ? true
         :                (any(p, tree.left) || any(p, tree.right));
}

function all<T>(p: (elem: T) => boolean, tree: Tree<T>): boolean {
    return !tree         ? true
         : !p(tree.elem) ? false
         :                 (all(p, tree.left) && all(p, tree.right));
}

function iterateAsc<T>(tree: Tree<T>): ReversibleIterableIterator<T> {
    function *goAsc(tree: Tree<T>): IterableIterator<T> {
        if (tree) {
            yield* goAsc(tree.left);
            yield  tree.elem;
            yield* goAsc(tree.right);
        }
    }
    function *goDesc(tree: Tree<T>): IterableIterator<T> {
        if (tree) {
            yield* goDesc(tree.right);
            yield  tree.elem;
            yield* goDesc(tree.left);
        }
    }
    return reversible(goAsc(tree), () => goDesc(tree));
}

function filter<T>(p: (elem: T) => boolean, tree: Tree<T>): Tree<T> {
    if (!tree) {
        return null;
    }
    else {
        const {elem: e, left: l, right: r} = tree;
        if (p(e)) {
            const l1 = filter(p, l);
            const r1 = filter(p, r);
            return l1 === l && r1 === r
                ? tree
                : link(e, l1, r1);
        }
        else {
            return link2(l, r);
        }
    }
}

function partition<T>(p: (elem: T) => boolean, tree: Tree<T>): [Tree<T>, Tree<T>] {
    if (!tree) {
        return [null, null];
    }
    else {
        const {elem: e, left: l, right: r} = tree;
        const [l1, l2] = partition(p, l);
        const [r1, r2] = partition(p, r);
        if (p(e))
            return [
                l1 === l && r1 === r
                    ? tree
                    : link(e, l1, r1),
                link2(l2, r2)
            ];
        else
            return [
                link2(l1, r1),
                l2 === l && r2 === r
                    ? tree
                    : link(e, l2, r2)
            ];
    }
}

/// Package private: user code should not use this.
export function split<T>(cmp: CompareFn<T>, elem: T, tree: Tree<T>): [Tree<T>, boolean, Tree<T>] {
    if (!tree) {
        return [null, false, null];
    }
    else {
        const {elem: e, left: l, right: r} = tree;
        switch (coerceOrd(cmp(elem, e))) {
            case -1: {
                const [ll, lb, lr] = split(cmp, elem, l);
                return [ll, lb, link(e, lr, r)];
            }
            case  1: {
                const [rl, rb, rr] = split(cmp, elem, r)
                return [link(e, l, rl), rb, rr];
            }
            case  0:
                return [l, true, r];
        }
    }
}

function lookupIndex<T>(cmp: CompareFn<T>, elem: T, tree: Tree<T>): number|undefined {
    let idx = 0;
    while (true) {
        if (!tree) {
            return undefined;
        }
        else {
            const {elem: e, left: l, right: r} = tree;
            switch (coerceOrd(cmp(elem, e))) {
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

function elemAt<T>(idx: number, tree: Tree<T>): T|undefined {
    while (true) {
        if (!tree) {
            return undefined;
        }
        else {
            const {elem: e, left: l, right: r} = tree;
            const ls = size(l);
            if (idx < ls) {
                tree = l;
            }
            else if (idx > ls) {
                idx -= ls + 1;
                tree = r;
            }
            else {
                return e;
            }
        }
    }
}

function take<T>(n: number, tree: Tree<T>): Tree<T> {
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
        const {elem: e, left: l, right: r} = tree;
        const ls = size(l);
        if (n < ls)
            return take(n, l);
        else if (n > ls)
            return link(e, l, take(n - ls - 1, r));
        else
            return l;
    }
}

function drop<T>(n: number, tree: Tree<T>): Tree<T> {
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
        const {elem: e, left: l, right: r} = tree;
        const ls = size(l);
        if (n < ls)
            return link(e, drop(n, l), r);
        else if (n > ls)
            return drop(n - ls - 1, r);
        else
            return insertMin(e, r);
    }
}

function splitAt<T>(i: number, tree: Tree<T>): [Tree<T>, Tree<T>] {
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
        const {elem: e, left: l, right: r} = tree;
        const ls = size(l);
        if (i < ls) {
            const [ll, lr] = splitAt(i, l);
            return [ll, link(e, lr, r)];
        }
        else if (i > ls) {
            const [rl, rr] = splitAt(i - ls - 1, r);
            return [link(e, l, rl), rr];
        }
        else {
            return [l, insertMin(e, r)];
        }
    }
}

function deleteAt<T>(idx: number, tree: Tree<T>): Tree<T> {
    if (!tree) {
        return null;
    }
    else {
        const {elem: e, left: l, right: r} = tree;
        const ls = size(l);
        if (idx < ls) {
            const l1 = deleteAt(idx, l);
            return balanceR(e, l1, r);
        }
        else if (idx > ls) {
            const r1 = deleteAt(idx-ls-1, r);
            return balanceL(e, l, r1);
        }
        else {
            return glue(l, r);
        }
    }
}

function lookupMin<T>(tree: Tree<T>): T|undefined {
    if (!tree) {
        return undefined;
    }
    else {
        if (!tree.left)
            return tree.elem;
        else
            return lookupMin(tree.left);
    }
}

function lookupMax<T>(tree: Tree<T>): T|undefined {
    if (!tree) {
        return undefined;
    }
    else {
        if (!tree.right)
            return tree.elem;
        else
            return lookupMax(tree.right);
    }
}

function deleteMin<T>(tree: Tree<T>): Tree<T> {
    if (!tree) {
        return tree;
    }
    else {
        if (!tree.left)
            return tree.right;
        else
            return balanceR(tree.elem, deleteMin(tree.left), tree.right);
    }
}

function deleteMax<T>(tree: Tree<T>): Tree<T> {
    if (!tree) {
        return tree;
    }
    else {
        if (!tree.right)
            return tree.left;
        else
            return balanceL(tree.elem, tree.left, deleteMax(tree.right));
    }
}

function minView<T>(tree: Tree<T>): [T, Tree<T>]|undefined;
function minView<T>(bin: Bin<T>): [T, Tree<T>];
function minView(arg: any) {
    if (!arg) {
        return undefined;
    }
    else {
        if (!arg.left) {
            return [arg.elem, arg.right];
        }
        else {
            const [me, left1] = minView(arg.left)!;
            return [me, balanceR(arg.elem, left1, arg.right)];
        }
    }
}

function maxView<T>(tree: Tree<T>): [T, Tree<T>]|undefined;
function maxView<T>(bin: Bin<T>): [T, Tree<T>];
function maxView(arg: any) {
    if (!arg) {
        return undefined;
    }
    else if (!arg.right) {
        return [arg.elem, arg.left];
    }
    else {
        const [me, right1] = maxView(arg.right)!;
        return [me, balanceL(arg.elem, arg.left, right1)];
    }
}

// Construct a singleton tree with an element. */
function singleton<T>(elem: T): Tree<T> {
    return {size: 1, elem, left: null, right: null};
}

// Construct a tree with all the components explicitly specified. The tree
// is assumed to be balanced. Package private.
export function bin<T>(size: number, elem: T, left: Tree<T>, right: Tree<T>): Tree<T>;

// Construct a tree with everything but size. The tree is assumed to be
// balanced. Package private.
export function bin<T>(elem: T, left: Tree<T>, right: Tree<T>): Tree<T>;

export function bin<T>(...args: any[]): Tree<T> {
    switch (args.length) {
        case 4:
            return {size: args[0], elem: args[1], left: args[2], right: args[3]};
        case 3:
            return {
                size:  size(args[1]) + size(args[2]) + 1,
                elem:  args[0],
                left:  args[1],
                right: args[2]
            };
        default:
            throw new TypeError("Wrong number of arguments");
    }
}

// Construct a tree with an element, the left subtree, and the right
// subtree. Subtrees need not be balanced at all, but must not already
// contain the element.
function link<T>(e: T, l: Tree<T>, r: Tree<T>): Tree<T> {
    if (!l) {
        return insertMin(e, r);
    }
    else if (!r) {
        return insertMax(e, l);
    }
    else {
        const {size: ls, elem: le, left: ll, right: lr} = l;
        const {size: rs, elem: re, left: rl, right: rr} = r;
        if (DELTA*ls < rs)
            return balanceL(re, link(e, l, rl), rr);
        else if (DELTA*rs < ls)
            return balanceL(le, ll, link(e, lr, r));
        else
            return bin(e, l, r);
    }
}

// Merge two trees and restore the balance.
function link2<T>(l: Tree<T>, r: Tree<T>): Tree<T> {
    if (!l) {
        return r;
    }
    else if (!r) {
        return l;
    }
    else {
        const {size: ls, elem: le, left: ll, right: lr} = l;
        const {size: rs, elem: re, left: rl, right: rr} = r;
        if (DELTA*ls < rs)
            return balanceL(re, link2(l, rl), rr);
        else if (DELTA*rs < ls)
            return balanceL(le, ll, link2(lr, r));
        else
            return glue(l, r);
    }
}

// Glue two trees together, assuming they both are already balanced with
// respect to each other.
function glue<T>(l: Tree<T>, r: Tree<T>) {
    if (!l) {
        return r;
    }
    else if (!r) {
        return l;
    }
    else {
        if (l.size > r.size) {
            const [me, l1] = maxView(l)!;
            return balanceR(me, l1, r);
        }
        else {
            const [me, r1] = minView(r)!;
            return balanceL(me, l, r1);
        }
    }
}

// Insert a new element, assuming no existing elements in the set are as
// small as the given one. This invariant is not checked.
function insertMin<T>(elem: T, tree: Tree<T>): Tree<T> {
    if (!tree) {
        return singleton(elem);
    }
    else {
        return balanceL(tree.elem, insertMin(elem, tree.left), tree.right);
    }
}

// Insert a new element, assuming no existing elements in the set are as
// large as the given one. This invariant is not checked.
function insertMax<T>(elem: T, tree: Tree<T>): Tree<T> {
    if (!tree) {
        return singleton(elem);
    }
    else {
        return balanceR(tree.elem, tree.left, insertMax(elem, tree.right));
    }
}

// balanceL() only checks if the left subtree is too big. Used when the left
// subtree might have been inserted to or when the right subtree might have
// been deleted from.
function balanceL<T>(e: T, l: Tree<T>, r: Tree<T>): Tree<T> {
    if (!r) {
        if (!l) {
            return singleton(e);
        }
        else {
            const {size: ls, elem: le, left: ll, right: lr} = l;
            if (!ll) {
                if (!lr) {
                    return bin(2, e, l, null);
                }
                else {
                    const {elem: lre} = lr;
                    return bin(3, lre, singleton(le), singleton(e));
                }
            }
            else {
                if (!lr) {
                    return bin(3, le, ll, singleton(e));
                }
                else {
                    const {size: lls} = ll;
                    const {size: lrs, elem: lre, left: lrl, right: lrr} = lr;
                    if (lrs < RATIO*lls)
                        return bin(1+ls, le, ll, bin(1+lrs, e, lr, null));
                    else
                        return bin(1+ls, lre,
                                   bin(1+lls+size(lrl), le, ll, lrl),
                                   bin(1+size(lrr), e, lrr, null));
                }
            }
        }
    }
    else {
        const {size: rs} = r;
        if (!l) {
            return bin(1+rs, e, null, r);
        }
        else {
            const {size: ls, elem: le, left: ll, right: lr} = l;
            if (ls > DELTA*rs) {
                if (!ll || !lr) {
                    throw new Error("invalid tree");
                }
                const {size: lls} = ll;
                const {size: lrs, elem: lre, left: lrl, right: lrr} = lr;
                if (lrs < RATIO*lls)
                    return bin(1+ls+rs, le, ll,
                               bin(1+rs+lrs, e, lr, r));
                else
                    return bin(1+ls+rs, lre,
                               bin(1+lls+size(lrl), le, ll, lrl),
                               bin(1+rs+size(lrr), e, lrr, r));
            }
            else {
                return bin(1+ls+rs, e, l, r);
            }
        }
    }
}

// balanceR() only checks if the right subtree is too big. Used when the
// right subtree might have been inserted to or when the left subtree might
// have been deleted from.
function balanceR<T>(e: T, l: Tree<T>, r: Tree<T>): Tree<T> {
    if (!l) {
        if (!r) {
            return singleton(e);
        }
        else {
            const {size: rs, elem: re, left: rl, right: rr} = r;
            if (!rl) {
                if (!rr)
                    return bin(2, e, null, r);
                else
                    return bin(3, re, singleton(e), rr);
            }
            else {
                const {size: rls, elem: rle, left: rll, right: rlr} = rl;
                if (!rr) {
                    return bin(3, rle, singleton(e), singleton(re));
                }
                else {
                    const {size: rrs} = rr;
                    if (rls < RATIO*rrs)
                        return bin(1+rs, re,
                                   bin(1+rls, e, null, rl), rr);
                    else
                        return bin(1+rs, rle,
                                   bin(1+size(rll), e, null, rll),
                                   bin(1+rrs+size(rlr), re, rlr, rr));
                }
            }
        }
    }
    else {
        const {size: ls} = l;
        if (!r) {
            return bin(1 + ls, e, l, null);
        }
        else {
            const {size: rs, elem: re, left: rl, right: rr} = r;
            if (rs > DELTA*ls) {
                if (!rl || !rr) {
                    throw new Error("invalid tree");
                }
                const {size: rls, elem: rle, left: rll, right: rlr} = rl;
                const {size: rrs} = rr;
                if (rls < RATIO*rrs)
                    return bin(1+ls+rs, re,
                               bin(1+ls+rls, e, l, rl), rr);
                else
                    return bin(1+ls+rs, rle,
                               bin(1+ls+size(rll), e, l, rll),
                               bin(1+rrs+size(rlr), re, rlr, rr));
            }
            else {
                return bin(1+ls+rs, e, l, r);
            }
        }
    }
}

// Take a queue of elements and build a tree from it. The reason why we
// don't take an iterator of elements is that directly working with
// iterators is way too inconvenient.
function buildFrom<T>(cmp: CompareFn<T>, elems: Queue<T>): Tree<T> {
    if (elems.isEmpty) {
        // Empty imput -> empty tree
        return null;
    }

    const [fst, rest] = elems.uncons();
    const tree        = singleton(fst);
    if (rest.isEmpty) {
        // Singleton input -> singleton tree
        return tree;
    }

    return !isOrdered(cmp, fst, rest)
        ? buildFromUnordered(cmp, tree, rest)
        : buildFromOrdered(cmp, 1, tree, rest);
}

function isOrdered<T>(cmp: CompareFn<T>, fst: T, rest: Queue<T>): boolean {
    return rest.isEmpty
        ? true // No more elements to compare.
        : cmp(fst, rest.head) < 0;
}

// O(n log n) way of building a tree from an unordered queue. Always usable.
function buildFromUnordered<T>(cmp: CompareFn<T>, tree: Tree<T>, elems: Queue<T>): Tree<T> {
    return elems.foldl((t, e) => insert(cmp, e, t), tree);
}

// O(n) way of building a tree from a strictly-ascending queue.
function buildFromOrdered<T>(cmp: CompareFn<T>, height: number, tree: Tree<T>, elems: Queue<T>): Tree<T> {
    if (elems.isEmpty) {
        // No more elements to insert.
        return tree;
    }
    else {
        const [fst, rest] = elems.uncons();
        if (rest.isEmpty) {
            // Just one element to insert.
            return insertMax(fst, tree);
        }
        else if (!isOrdered(cmp, fst, rest)) {
            // We have more than a single element to insert, but the second
            // element isn't strictly-ascending. Fall back to the O(n log
            // n) way.
            return buildFromUnordered(cmp, tree, elems);
        }
        else {
            // We now have a tree of some non-zero height. It would be
            // awesome if we could build another tree of the same height,
            // and link them together with the element `fst`. But this is
            // only possible if the input is ordered. We know `fst` is
            // greater than every element in `tree`.
            const [right, ordRest, unordRest] = buildSibling(cmp, height, rest);
            // Either ordRest or unordRest is non-empty. Never both.
            const left   = tree;
            const linked = link(fst, left, right);
            return !ordRest.isEmpty
                ? buildFromOrdered(cmp, height+1, linked, ordRest)
                : buildFromUnordered(cmp, linked, unordRest);
        }
    }
}

function buildSibling<T>(cmp: CompareFn<T>, height: number, elems: Queue<T>): [Tree<T>, Queue<T>, Queue<T>] {
    if (elems.isEmpty) {
        return [null, Queue.empty, Queue.empty];
    }
    else {
        const [fst, rest] = elems.uncons();
        if (height === 1) {
            const tree = singleton(fst);
            return !isOrdered(cmp, fst, rest)
                ? [tree, Queue.empty, rest]
                : [tree, rest, Queue.empty];
        }
        else {
            // Height of two or more: build two subtrees with one less
            // height.
            const sibling = buildSibling(cmp, height-1, elems);
            const [left, ordRest, _] = sibling;

            if (ordRest.isEmpty) {
                // It's unordered. We must fall back to the O(n log n) way.
                return sibling;
            }
            else {
                const [ordFst, ordRest1] = ordRest.uncons();
                if (ordRest1.isEmpty) {
                    // It's ordered and we have the very last element to
                    // insert.
                    return [insertMax(ordFst, left), Queue.empty, Queue.empty];
                }
                else if (!isOrdered(cmp, ordFst, ordRest1)) {
                    // It was the last ordered element. We know ordFst is
                    // ordered but we can't make use of the fact.
                    return [left, Queue.empty, ordRest];
                }
                else {
                    // Great... it's still ordered. Try building the right
                    // subtree.
                    const [right, ordRest2, unordRest2] = buildSibling(cmp, height-1, ordRest1);
                    return [link(ordFst, left, right), ordRest2, unordRest2];
                    // Maybe we can use bin() instead of link() if left and
                    // right have the same size? Is that safe?
                }
            }
        }
    }
}
