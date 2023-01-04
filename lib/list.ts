interface Cell<T> {
    prev: Cell<T>|null;
    next: Cell<T>|null;
    readonly elem: T;
}

/** A doubly-linked list: shift() and unshift() perform better than
 * arrays.
 */
export class List<T> {
    #head: Cell<T>|null;
    #tail: Cell<T>|null;

    public constructor() {
        this.#head = null;
        this.#tail = null;
    }

    public get isEmpty(): boolean {
        return this.#head == null;
    }

    public push(t: T): this {
        const cell = {
            prev: this.#tail,
            next: null,
            elem: t
        };

        if (!this.#head) {
            this.#head = cell;
        }

        if (this.#tail) {
            this.#tail.next = cell;
        }
        this.#tail = cell;

        return this;
    }

    public pop(): T|undefined {
        if (this.#tail) {
            const cell = this.#tail;
            if (this.#tail.prev) {
                this.#tail.prev.next = null;
                this.#tail           = this.#tail.prev;
            }
            else {
                this.#head = null;
                this.#tail = null;
            }
            return cell.elem;
        }
        else {
            return undefined;
        }
    }

    public unshift(t: T): this {
        const cell = {
            prev: null,
            next: this.#head,
            elem: t
        };

        if (this.#head) {
            this.#head.prev = cell;
        }
        this.#head = cell;

        if (!this.#tail) {
            this.#tail = cell;
        }

        return this;
    }

    public shift(): T|undefined {
        if (this.#head) {
            const cell = this.#head;
            if (this.#head.next) {
                this.#head.next.prev = null;
                this.#head           = this.#head.next;
            }
            else {
                this.#head = null;
                this.#tail = null;
            }
            return cell.elem;
        }
        else {
            return undefined;
        }
    }

    public filter(p: (t: T) => boolean): this {
        for (let cell = this.#head; cell; cell = cell.next) {
            if (!p(cell.elem)) {
                if (cell.prev) {
                    cell.prev.next = cell.next;
                }
                else {
                    this.#head = null;
                }

                if (cell.next) {
                    cell.next.prev = cell.prev;
                }
                else {
                    this.#tail = null;
                }
            }
        }
        return this;
    }
}
