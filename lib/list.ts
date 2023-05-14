interface Cell<T> {
    readonly elem: T;
    readonly next: Cell<T>|null;
}

/** An immutable list-like data structure with amortised O(1) for `cons`
 * and `snoc` operations.
 */
export class List<T> {
    readonly #prefix: Cell<T>|null;
    readonly #suffix: Cell<T>|null; // reverse order

    private constructor(prefix: Cell<T>|null, suffix: Cell<T>|null) {
        this.#prefix = prefix;
        this.#suffix = suffix;
    }

    // QuickJS doesn't allow this: it follows the ES2020 semantics so
    // "List" will be put in the context at the very end of class
    // initialisation. "new List()" is not possible in property
    // initialisers.
    //public static readonly empty: List<any> = new List(null, null);
    //
    // So this is a workaround:
    public static readonly empty: List<any>;

    public static singleton<T>(v: T): List<T> {
        return List.empty.snoc(v);
    }

    public get isEmpty(): boolean {
        return this.#prefix === null && this.#suffix === null;
    }

    public cons(v: T): List<T> {
        return new List({elem: v, next: this.#prefix}, this.#suffix);
    }

    public uncons(): [T|undefined, List<T>] {
        if (this.#prefix) {
            return [this.#prefix.elem, new List(this.#prefix.next, this.#suffix)];
        }
        else {
            const prefix = List.reverse(this.#suffix);
            if (prefix) {
                return [prefix.elem, new List(prefix.next, this.#suffix)];
            }
            else {
                return [undefined, this];
            }
        }
    }

    public snoc(v: T): List<T> {
        return new List(this.#prefix, {elem: v, next: this.#suffix});
    }

    public unsnoc(): [List<T>, T|undefined] {
        if (this.#suffix) {
            return [new List(this.#prefix, this.#suffix.next), this.#suffix.elem];
        }
        else {
            const suffix = List.reverse(this.#prefix);
            if (suffix) {
                return [new List(null, suffix.next), suffix.elem];
            }
            else {
                return [this, undefined];
            }
        }
    }

    public *[Symbol.iterator](): IterableIterator<T> {
        for (let cell = this.#prefix; cell; cell = cell.next) {
            yield cell.elem;
        }
        for (let cell = List.reverse(this.#suffix); cell; cell = cell.next) {
            yield cell.elem;
        }
    }

    public filter(p: (v: T) => boolean): List<T> {
        function go(list: Cell<T>|null): Cell<T>|null {
            let acc: Cell<T>|null = null;
            for (let cell = list; cell; cell = cell.next) {
                if (p(cell.elem)) {
                    acc = {elem: cell.elem, next: acc};
                }
            }
            return List.reverse(acc);
        }
        return new List(go(this.#prefix), go(this.#suffix));
    }

    private static reverse<T>(list: Cell<T>|null): Cell<T>|null {
        let acc: Cell<T>|null = null;
        for (let cell = list; cell; cell = cell.next) {
            acc = {elem: cell.elem, next: acc};
        }
        return acc;
    }
}

// @ts-ignore: See above
List.empty = new List(null, null);
