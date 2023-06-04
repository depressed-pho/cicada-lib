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
    readonly length: number;
    readonly #prefix: List<T>;
    readonly #suffix: List<T>; // in reverse order

    private constructor(length: number, prefix: List<T>, suffix: List<T>) {
        this.length  = length;
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
        return new Queue(1, {elem: v, next: null}, null);
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
                return new Queue(this.length + 1, {elem: v, next: null}, this.#prefix);
            }
        }
        else {
            // The suffix isn't empty. We can prepend it to the prefix
            // without violating the invariant.
            return new Queue(this.length + 1, {elem: v, next: this.#prefix}, this.#suffix);
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
    public uncons(): [T, Queue<T>] {
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
            return [this.#prefix.elem, new Queue(this.length - 1, this.#prefix.next, this.#suffix)];
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
                return new Queue(this.length + 1, this.#suffix, {elem: v, next: null});
            }
        }
        else {
            // The prefix isn't empty. We can append it to the suffix
            // without violating the invariant.
            return new Queue(this.length + 1, this.#prefix, {elem: v, next: this.#suffix});
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
    public unsnoc(): [Queue<T>, T] {
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
            return [new Queue(this.length - 1, this.#prefix, this.#suffix.next), this.#suffix.elem];
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

    /** O(m+n). Concatenate two or more queues. */
    public concat(...qs: Queue<T>[]): Queue<T> {
        function go(a: Queue<T>, b: Queue<T>): Queue<T> {
            if (a.isEmpty) {
                return b;
            }
            else if (b.isEmpty) {
                return a;
            }
            else {
                return new Queue(
                    a.length + b.length,
                    Queue.#concat(a.#prefix, Queue.#reverse(a.#suffix, b.#prefix)),
                    b.#suffix);
            }
        }
        let ret: Queue<T> = this;
        for (const q of qs) {
            ret = go(ret, q);
        }
        return ret;
    }

    /** O(n). Return elements of the queue after the first `n`. If the
     * queue contains fewer than `n` elements, the entire queue is
     * returned.
     */
    public take(n: number): Queue<T> {
        if (n <= 0) {
            return Queue.empty;
        }
        else if (n >= this.length || !this.#prefix || !this.#suffix) {
            return this;
        }
        else {
            const pLen = Queue.#length(this.#prefix);
            if (n < pLen) {
                // We can completely ignore the suffix.
                let taken: List<T> = null; // in reverse order
                for (let i = 0, cell = this.#prefix; i < n && cell; i++, cell = cell.next!) {
                    taken = {elem: cell.elem, next: taken};
                }
                return Queue.#balanceSuffix(taken);
            }
            else if (n > pLen) {
                const sLen = Queue.#length(this.#suffix);
                let taken: List<T> = this.#suffix; // in reverse order
                for (let i = 0; i < sLen - (n - pLen); i++) {
                    taken = taken!.next;
                }
                return Queue.#link(this.#prefix, taken);
            }
            else {
                return Queue.#balancePrefix(this.#prefix);
            }
        }
    }

    /** O(n). Return elements of the queue after the first `n`. If the
     * queue contains fewer than `n` elements, the empty queue is
     * returned.
     */
    public drop(n: number): Queue<T> {
        if (n <= 0) {
            return this;
        }
        else if (n >= this.length || !this.#prefix || !this.#suffix) {
            return Queue.empty;
        }
        else {
            const pLen = Queue.#length(this.#prefix);
            if (n < pLen) {
                let rem: List<T> = this.#prefix;
                for (let i = 0; i < n; i++) {
                    rem = rem!.next;
                }
                return Queue.#link(rem, this.#suffix);
            }
            else if (n > pLen) {
                // We can completely ignore the prefix.
                const sLen = Queue.#length(this.#suffix);
                let rem: List<T> = null; // in reverse order
                for (let i = 0, cell = this.#suffix; i < sLen - (n - pLen) && cell; i++, cell = cell.next!) {
                    rem = {elem: cell.elem, next: rem};
                }
                return Queue.#balancePrefix(rem);
            }
            else {
                return Queue.#balanceSuffix(this.#suffix);
            }
        }
    }

    /** O(n). Fold the queue with a left-associative operator. */
    public foldl<A>(f: (acc: A, v: T) => A, init: A): A {
        const acc1 = Queue.#foldl(f, init, this.#prefix);
        return Queue.#foldr((v, acc) => f(acc, v), acc1, this.#suffix);
    }

    /** O(n). Fold the queue with a right-associative operator. */
    public foldr<A>(f: (v: T, acc: A) => A, init: A): A {
        const acc1 = Queue.#foldl((acc, v) => f(v, acc), init, this.#suffix);
        return Queue.#foldr(f, acc1, this.#prefix);
    }

    /** O(n). Return `true` iff there is at least one element that
     * satisfies the given predicate.
     */
    public any(p: (v: T) => boolean): boolean {
        return Queue.#any(p, this.#prefix) || Queue.#any(p, this.#suffix);
    }

    /** O(n). Return `true` iff there are no elements that don't satisfy
     * the given predicate.
     */
    public all(p: (v: T) => boolean): boolean {
        return Queue.#all(p, this.#prefix) && Queue.#all(p, this.#suffix);
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

        return Queue.#linkRev(revPrefix, revSuffix);
    }

    /** O(n). Partition the queue according to a predicate. The first queue
     * contains elements that satisfy the predicate, and the second queue
     * contains those that don't.
     */
    public partition(p: (v: T) => boolean): [Queue<T>, Queue<T>] {
        function go(list: List<T>): [List<T>, List<T>] {
            let accT: List<T> = null;
            let accF: List<T> = null;
            for (let cell = list; cell; cell = cell.next) {
                if (p(cell.elem))
                    accT = {elem: cell.elem, next: accT};
                else
                    accF = {elem: cell.elem, next: accF};
            }
            return [accT, accF]; // The results are in reverse order.
        }
        const [revPrefixT, revPrefixF] = go(this.#prefix);
        const [revSuffixT, revSuffixF] = go(this.#suffix);

        return [
            Queue.#linkRev(revPrefixT, revSuffixT),
            Queue.#linkRev(revPrefixF, revSuffixF)
        ];
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

    /** O(n). Split the queue into two queues. The first queue is the
     * longest prefix of elements which satisfy the predicate `p` and the
     * second is the remainder of the queue.
     */
    public spanl(p: (v: T) => boolean): [Queue<T>, Queue<T>] {
        let fst: List<T> = null; // in reverse order
        let snd: List<T> = null;
        for (let cell = this.#prefix; cell; cell = cell.next) {
            if (p(cell.elem)) {
                fst = {elem: cell.elem, next: fst};
            }
            else {
                snd = cell;
                break;
            }
        }
        if (snd)
            // We have found a break point in the prefix, which means the
            // entire suffix should be a part of the second queue.
            return [
                Queue.#balanceSuffix(fst),
                Queue.#link(snd, this.#suffix)
            ];
        for (let cell = Queue.#reverse(this.#suffix); cell; cell = cell.next) {
            if (p(cell.elem)) {
                fst = {elem: cell.elem, next: fst};
            }
            else {
                snd = cell;
                break;
            }
        }
        return [
            Queue.#balanceSuffix(fst),
            Queue.#balancePrefix(snd)
        ];
    }

    /** O(n). This is like {@link spanl} but the predicate is negated. */
    public breakl(p: (v: T) => boolean): [Queue<T>, Queue<T>] {
        return this.spanl(v => !p(v));
    }

    /** O(n). This is like {@link spanr} but the predicate is negated. */
    public breakr(p: (v: T) => boolean): [Queue<T>, Queue<T>] {
        return this.spanr(v => !p(v));
    }

    /** O(n). Split the queue into two queues. The first queue is the
     * longest suffix of elements which satisfy the predicate `p` and the
     * second is the remainder of the queue.
     */
    public spanr(p: (v: T) => boolean): [Queue<T>, Queue<T>] {
        let fst: List<T> = null;
        let snd: List<T> = null; // in reverse order
        for (let cell = this.#suffix; cell; cell = cell.next) {
            if (p(cell.elem)) {
                fst = {elem: cell.elem, next: fst};
            }
            else {
                snd = cell;
                break;
            }
        }
        if (snd)
            // We have found a break point in the suffix, which means the
            // entire prefix should be a part of the second queue.
            return [
                Queue.#balancePrefix(fst),
                Queue.#link(this.#prefix, snd)
            ];
        for (let cell = Queue.#reverse(this.#prefix); cell; cell = cell.next) {
            if (p(cell.elem)) {
                fst = {elem: cell.elem, next: fst};
            }
            else {
                snd = cell;
                break;
            }
        }
        return [
            Queue.#balancePrefix(fst),
            Queue.#balanceSuffix(snd)
        ];
    }

    static #link<T>(prefix: List<T>, suffix: List<T>): Queue<T> {
        return !prefix ? this.#balanceSuffix(suffix)
             : !suffix ? this.#balancePrefix(prefix)
             :           new Queue(this.#length(prefix) + this.#length(suffix),
                                   prefix, suffix);
    }

    static #linkRev<T>(revPrefix: List<T>, revSuffix: List<T>): Queue<T> {
        return !revPrefix ? this.#balancePrefix(revSuffix)
             : !revSuffix ? this.#balanceSuffix(revPrefix)
             :              new Queue(this.#length(revPrefix) + this.#length(revSuffix),
                                      this.#reverse(revPrefix),
                                      this.#reverse(revSuffix));
    }

    static #balancePrefix<T>(prefix: List<T>): Queue<T> {
        if (!prefix) {
            // It's an empty list.
            return this.empty;
        }
        else if (!prefix.next) {
            // It's a singleton.
            return new Queue(1, prefix, null);
        }
        else if (!prefix.next.next) {
            // The queue has exactly two elements.
            return new Queue(
                2,
                {elem: prefix.elem     , next: null},
                {elem: prefix.next.elem, next: null});
        }
        else {
            // There's more. Move half of elements to suffix.
            const len        = this.#length(prefix);
            const [fst, snd] = this.#splitAt(len >>> 1, prefix);
            return new Queue(len, fst, this.#reverse(snd));
        }
    }

    static #balanceSuffix<T>(suffix: List<T>): Queue<T> {
        if (!suffix) {
            // It's an empty list.
            return this.empty;
        }
        else if (!suffix.next) {
            // It's a singleton.
            return new Queue(1, suffix, null);
        }
        else if (!suffix.next.next) {
            // The queue has exactly two elements.
            return new Queue(
                2,
                {elem: suffix.next.elem, next: null},
                {elem: suffix.elem     , next: null});
        }
        else {
            // There's more. Move half of elements to prefix.
            const len        = this.#length(suffix);
            const [fst, snd] = this.#splitAt(len >>> 1, suffix);
            return new Queue(len, this.#reverse(snd), fst);
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

    static #concat<T>(a: List<T>, b: List<T>): List<T> {
        return this.#reverse(this.#reverse(a), b);
    }

    static #reverse<T>(list: List<T>, suffix?: List<T>): List<T> {
        if (!list) {
            // It's an empty list.
            return suffix ?? null;
        }
        else if (!list.next) {
            // It's a singleton. Reversing it is a no-op.
            return {elem: list.elem, next: suffix ?? null};
        }
        else {
            let acc: List<T> = suffix ?? null;
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

    static #any<T>(p: (v: T) => boolean, list: List<T>): boolean {
        for (let cell = list; cell; cell = cell.next) {
            if (p(cell.elem)) {
                return true;
            }
        }
        return false;
    }

    static #all<T>(p: (v: T) => boolean, list: List<T>): boolean {
        for (let cell = list; cell; cell = cell.next) {
            if (!p(cell.elem)) {
                return false;
            }
        }
        return true;
    }
}
// @ts-ignore: See above
Queue.empty = new Queue(0, null, null);
