type List<T> = null | Cell<T>;

interface Cell<T> {
    readonly elem: T;
    readonly next: List<T>;
}

/** An immutable list-like data structure with amortised O(1) for both
 * `cons` and `snoc` operations.
 */
export class Queue<T> implements Iterable<T> {
    // Invariant: When the prefix is empty, the suffix is either empty or a
    // singleton. And when the suffix is empty, the prefix is either empty
    // or a singleton.
    readonly #prefix: List<T>;
    readonly #suffix: List<T>; // in reverse order

    private constructor(prefix: List<T>, suffix: List<T>) {
        this.#prefix = prefix;
        this.#suffix = suffix;
    }

    /** O(1) The empty queue. */
    // QuickJS doesn't allow this: it follows the ES2020 semantics so the
    // binding "Queue" will be put in the context at the very end of class
    // initialisation. "new Queue()" is not possible in property
    // initialisers.
    //public static readonly empty: Queue<any> = new Queue(null, null);
    //
    // So this is a workaround:
    public static readonly empty: Queue<any>;

    /** O(1). Create a singleton queue. */
    public static singleton<T>(v: T): Queue<T> {
        return new Queue({elem: v, next: null}, null);
    }

    /** O(n). Turn an iterable object into a queue. */
    public static "from"<T>(values: Iterable<T>): Queue<T> {
        let suffix: List<T> = null;
        for (const v of values) {
            suffix = {elem: v, next: suffix};
        }
        return this.#balanceSuffix(suffix);
    }

    /** O(1). See if the queue is empty or not. */
    public get isEmpty(): boolean {
        return this.#prefix === null && this.#suffix === null;
    }

    /** O(1). Prepend an element to the queue. */
    public cons(v: T): Queue<T> {
        if (!this.#suffix) {
            if (!this.#prefix) {
                // It's an empty queue. Create a singleton.
                return Queue.singleton(v);
            }
            else {
                // A special case where the prefix is a singleton and the
                // suffix is empty. We can cheaply create a queue with two
                // singletons.
                return new Queue({elem: v, next: null}, this.#prefix);
            }
        }
        else {
            // The suffix isn't empty. We can prepend it to the prefix
            // without violating the invariant.
            return new Queue({elem: v, next: this.#prefix}, this.#suffix);
        }
    }

    /** O(1). Get the first element of the queue, or throw if it's empty. */
    public get head(): T {
        if (!this.#prefix) {
            if (!this.#suffix) {
                throw new RangeError("The queue is empty");
            }
            else {
                // A special case where the prefix is empty and the suffix is a
                // singleton.
                return this.#suffix.elem;
            }
        }
        else {
            // The prefix isn't empty. Taking its head is trivial.
            return this.#prefix.elem;
        }
    }

    /** O(1) amortized, O(n) worst case. Split the queue into its first
     * element and the rest, or throw if it's empty.
     */
    public get uncons(): [T, Queue<T>] {
        if (!this.#prefix) {
            if (!this.#suffix) {
                throw new RangeError("The queue is empty");
            }
            else {
                // A special case where the prefix is empty and the suffix
                // is a singleton.
                return [this.#suffix.elem, Queue.empty];
            }
        }
        else if (!this.#prefix.next) {
            // The prefix is a singleton. Taking its head is trivial but we
            // have to rebalance the queue.
            return [this.#prefix.elem, Queue.#balanceSuffix(this.#suffix)];
        }
        else {
            // The prefix has two or more elements. Splitting it is
            // trivial.
            return [this.#prefix.elem, new Queue(this.#prefix.next, this.#suffix)];
        }
    }

    /** O(1). Append an element to the queue. */
    public snoc(v: T): Queue<T> {
        if (!this.#prefix) {
            if (!this.#suffix) {
                // It's an empty queue. Create a singleton.
                return Queue.singleton(v);
            }
            else {
                // A special case where the prefix is empty and the suffix
                // is a singleton. We can cheaply create a queue with two
                // singletons.
                return new Queue(this.#suffix, {elem: v, next: null});
            }
        }
        else {
            // The prefix isn't empty. We can append it to the suffix
            // without violating the invariant.
            return new Queue(this.#prefix, {elem: v, next: this.#suffix});
        }
    }

    /** O(1). Get the last element of the queue, or throw if it's empty. */
    public get last(): T {
        if (!this.#suffix) {
            if (!this.#prefix) {
                throw new RangeError("The queue is empty");
            }
            else {
                // A special case where the suffix is empty and the prefix is a
                // singleton.
                return this.#prefix.elem;
            }
        }
        else {
            // The suffix isn't empty. Taking its last is trivial.
            return this.#suffix.elem;
        }
    }

    /** O(1) amortized, O(n) worst case. Split the queue into its last
     * element and the rest, or throw if it's empty.
     */
    public get unsnoc(): [Queue<T>, T] {
        if (!this.#suffix) {
            if (!this.#prefix) {
                throw new RangeError("The queue is empty");
            }
            else {
                // A special case where the prefix is a singleton and the
                // suffix is empty.
                return [Queue.empty, this.#prefix.elem];
            }
        }
        else if (!this.#suffix.next) {
            // The suffix is a singleton. Taking its last is trivial but we
            // have to rebalance the queue.
            return [Queue.#balancePrefix(this.#prefix), this.#suffix.elem];
        }
        else {
            // The suffix has two or more elements. Splitting it is
            // trivial.
            return [new Queue(this.#prefix, this.#suffix.next), this.#suffix.elem];
        }
    }

    /** O(n). Iterate over elements in the queue. */
    public *[Symbol.iterator](): IterableIterator<T> {
        for (let cell = this.#prefix; cell; cell = cell.next) {
            yield cell.elem;
        }
        for (let cell = Queue.#reverse(this.#suffix); cell; cell = cell.next) {
            yield cell.elem;
        }
    }

    /** O(n). Fold the queue with a left-associative operator. */
    public foldl<A>(f: (acc: A, v: T) => A, init: A): A {
        const acc0 = Queue.#foldl(f, init, this.#prefix);
        return Queue.#foldr((v, acc) => f(acc, v), acc0, this.#suffix);
    }

    /** O(n). Create a new queue with only elements that satisfy the given
     * predicate.
     */
    public filter(p: (v: T) => boolean): Queue<T> {
        function go(list: List<T>): List<T> {
            let acc: List<T> = null;
            for (let cell = list; cell; cell = cell.next) {
                if (p(cell.elem)) {
                    acc = {elem: cell.elem, next: acc};
                }
            }
            return acc; // The result is in reverse order.
        }
        const revPrefix = go(this.#prefix);
        const revSuffix = go(this.#suffix);

        if (!revPrefix) {
            // The prefix is now empty and we have a reversed suffix. We
            // can consider the reversed suffix as a new prefix.
            return Queue.#balancePrefix(revSuffix);
        }
        else if (!revSuffix) {
            // The suffix is now empty and we have a reversed prefix. We
            // can consider the reversed prefix as a new suffix.
            return Queue.#balanceSuffix(revPrefix);
        }
        else {
            // Now we have a non-empty reversed prefix and a reversed
            // suffix. We have to reverse them both. This is still O(n) but
            // ugh..
            return new Queue(
                Queue.#reverse(revPrefix),
                Queue.#reverse(revSuffix));
        }
    }

    /** O(n). Apply the given function to each value in the queue from the
     * head to the last.
     */
    public forEach(f: (v: T, idx: number) => void): void {
        let idx = 0;
        for (const v of this) {
            f(v, idx);
            idx++;
        }
    }

    static #balancePrefix<T>(prefix: List<T>): Queue<T> {
        if (!prefix) {
            // It's an empty list.
            return this.empty;
        }
        else if (!prefix.next) {
            // It's a singleton.
            return new Queue(prefix, null);
        }
        else if (!prefix.next.next) {
            // The queue has exactly two elements.
            return new Queue(
                {elem: prefix.elem     , next: null},
                {elem: prefix.next.elem, next: null});
        }
        else {
            // There's more. Move half of elements to suffix.
            const [fst, snd] = this.#splitAt(this.#length(prefix) >>> 1, prefix);
            return new Queue(fst, this.#reverse(snd));
        }
    }

    static #balanceSuffix<T>(suffix: List<T>): Queue<T> {
        if (!suffix) {
            // It's an empty list.
            return this.empty;
        }
        else if (!suffix.next) {
            // It's a singleton.
            return new Queue(suffix, null);
        }
        else if (!suffix.next.next) {
            // The queue has exactly two elements.
            return new Queue(
                {elem: suffix.next.elem, next: null},
                {elem: suffix.elem     , next: null});
        }
        else {
            // There's more. Move half of elements to prefix.
            const [fst, snd] = this.#splitAt(this.#length(suffix) >>> 1, suffix);
            return new Queue(this.#reverse(snd), fst);
        }
    }

    static #length<T>(list: List<T>): number {
        let n = 0;
        for (let cell = list; cell; cell = cell.next) {
            n++;
        }
        return n;
    }

    static #splitAt<T>(pos: number, list: List<T>): [List<T>, List<T>] {
        let fst: List<T> = null; // in reverse order
        let snd: List<T> = null;
        for (let i = 0, cell = list; i < pos && cell; i++, cell = cell.next) {
            fst = {elem: cell.elem, next: fst};
            snd = cell.next;
        }
        return [this.#reverse(fst), snd];
    }

    static #reverse<T>(list: List<T>): List<T> {
        if (!list) {
            // It's an empty list.
            return null;
        }
        else if (!list.next) {
            // It's a singleton. Reversing it is a no-op.
            return list;
        }
        else {
            let acc: List<T> = null;
            for (let cell: List<T> = list; cell; cell = cell.next) {
                acc = {elem: cell.elem, next: acc};
            }
            return acc;
        }
    }

    static #foldl<A, T>(f: (acc: A, v: T) => A, init: A, list: List<T>): A {
        let acc = init;
        for (let cell = list; cell; cell = cell.next) {
            acc = f(acc, cell.elem);
        }
        return acc;
    }

    static #foldr<T, A>(f: (v: T, acc: A) => A, init: A, list: List<T>): A {
        let acc = init;
        for (let cell = this.#reverse(list); cell; cell = cell.next) {
            acc = f(cell.elem, acc);
        }
        return acc;
    }
}
// @ts-ignore: See above
Queue.empty = new Queue(null, null);
