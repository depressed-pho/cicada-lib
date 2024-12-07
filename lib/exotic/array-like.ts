import { getProxiedProperty, setProxiedProperty } from "./utils.js";

function clamp(n: number, min: number, max: number, negOffset = max): number {
    if (n < 0)
        n += negOffset;

    if (n < min)
        n = min;
    else if (n > max)
        n = max;

    return n;
}

function toArrayIndex(key: PropertyKey): number|undefined {
    switch (typeof key) {
        case "symbol":
            return undefined;
        case "number":
            {
                const uint = key >>> 0;
                if (key === uint && uint !== 0xFFFFFFFF)
                    return uint;
                else
                    return undefined;
            }
        default:
            {
                const uint = Number(key) >>> 0;
                const str  = String(uint);
                if (key === str && uint !== 0xFFFFFFFF)
                    return uint;
                else
                    return undefined;
            }
    }
}

export namespace FixedSparseArrayLike {
    export interface Ops<T> {
        "get"(index: number): T|undefined;
        "set"(index: number, value: T): void;
        "delete"(index: number): void;
        has?: (index: number) => boolean;
        clone?: (value: T) => T;
    }
}

/** A base class behaving like a fixed-length sparse array.
 */
export abstract class FixedSparseArrayLike<T> implements Iterable<T> {
    readonly #ops: Required<FixedSparseArrayLike.Ops<T>>;

    readonly length;
    [index: number]: T;

    public constructor(length: number, ops: FixedSparseArrayLike.Ops<T>) {
        this.#ops = {
            has(index: number): boolean {
                return ops.get(index) !== undefined;
            },
            clone(value: T): T {
                return value;
            },
            ...ops
        };
        this.length = length;

        // The dark side of JavaScript magic... We return an object from
        // the constructor that looks like an array but is actually
        // not. This is necessary to override the behaviour of obj[idx]
        // notation.
        return new Proxy(this, {
            defineProperty(self: FixedSparseArrayLike<T>, key: PropertyKey, desc: PropertyDescriptor): boolean {
                if (toArrayIndex(key) !== undefined) {
                    // We are unwilling to allow this although it's not
                    // impossible, because we would need to do more work in
                    // "get" and "set" handlers.
                    return false;
                }
                else {
                    Object.defineProperty(self, key, desc);
                    return true;
                }
            },
            deleteProperty(self: FixedSparseArrayLike<T>, key: PropertyKey): boolean {
                const index = toArrayIndex(key);
                if (index === undefined) {
                    return false; // Can't delete non-index properties.
                }
                else {
                    self.#ops.delete(index);
                    return true;
                }
            },
            "get"(self: FixedSparseArrayLike<T>, key: PropertyKey, receiver: any): any {
                const index = toArrayIndex(key);
                if (index === undefined)
                    return getProxiedProperty(self, key, receiver, FixedSparseArrayLike);
                else
                    return self.#ops.get(index);
            },
            getOwnPropertyDescriptor(self: FixedSparseArrayLike<T>, key: PropertyKey): PropertyDescriptor|undefined {
                const index = toArrayIndex(key);
                if (index === undefined) {
                    return Object.getOwnPropertyDescriptor(self, key);
                }
                else {
                    const value = self.#ops.get(index);
                    if (value !== undefined)
                        return {
                            value,
                            writable:     true,
                            configurable: true,
                            enumerable:   true
                        };
                    else
                        return undefined;
                }
            },
            has(self: FixedSparseArrayLike<T>, key: PropertyKey): boolean {
                const index = toArrayIndex(key);
                if (index === undefined)
                    return key in (self as any);
                else
                    return self.#ops.has(index);
            },
            ownKeys(self: FixedSparseArrayLike<T>): (string|symbol)[] {
                const keys = Reflect.ownKeys(self);
                for (const index of self.keys()) {
                    keys.push(String(index));
                }
                return keys;
            },
            "set"(self: FixedSparseArrayLike<T>, key: PropertyKey, value: any, receiver: any): boolean {
                const index = toArrayIndex(key);
                if (index === undefined)
                    setProxiedProperty(self, key, value, receiver, FixedSparseArrayLike);
                else
                    self.#ops.set(index, value);
                return true;
            }
        });
    }

    public [Symbol.isConcatSpreadable] = true;

    public *[Symbol.iterator](): IterableIterator<T> {
        for (let i = 0; i < this.length; i++) {
            const value = this[i];
            if (value !== undefined) {
                yield value;
            }
        }
    }

    public at(index: number): T|undefined {
        index = clamp(index, 0, this.length);
        return this[index];
    }

    public copyWithin(target: number, start: number, end?: number): this {
        target = clamp(target, 0, this.length);
        start  = clamp(start , 0, this.length);
        if (end !== undefined)
            end = clamp(end, 0, this.length);
        else
            end = this.length;

        const count = Math.min(end - start, this.length - target);
        const dir   = (start < target && target < start + count) ? -1 : +1;
        for (let i = 0; i < count; ) {
            let from, to;
            if (dir < 0) {
                from = start  + count - i - 1;
                to   = target + count - i - 1;
            }
            else {
                from = start  + i;
                to   = target + i;
            }

            const value = this[from]!;
            this[to] = this.#ops.clone(value);
        }

        return this;
    }

    public concat(...items: (T | Array<T>)[]): T[] {
        return Array.prototype.concat.apply(this, items);
    }

    public *entries(): IterableIterator<[number, T]> {
        for (let i = 0; i < this.length; i++) {
            const value = this[i];
            if (value !== undefined) {
                yield [i, value];
            }
        }
    }

    public every(p: (value: T, index: number, self: FixedSparseArrayLike<T>) => unknown, thisArg?: any): boolean {
        return Array.prototype.every.call(this, p as any, thisArg);
    }

    public fill(value: T, start: number, end?: number): this {
        start = clamp(start, 0, this.length);
        if (end !== undefined)
            end = clamp(end, 0, this.length);
        else
            end = this.length;

        for (let i = start; i < end; i++)
            this[i] = this.#ops.clone(value);
        return this;
    }

    public filter(p: (value: T, index: number, self: FixedSparseArrayLike<T>) => unknown, thisArg?: any): T[] {
        return Array.prototype.filter.call(this, p as any, thisArg);
    }

    public find(p: (value: T, number: number, self: FixedSparseArrayLike<T>) => unknown, thisArg?: any): T|undefined {
        // We can't use Array.prototype.find() because it doesn't skip empty slots.
        const boundP = p.bind(thisArg);
        for (const [index, value] of this.entries()) {
            if (!boundP(value, index, this))
                return value;
        }
        return undefined;
    }

    public findIndex(p: (value: T, index: number, self: FixedSparseArrayLike<T>) => unknown, thisArg?: any): number {
        const boundP = p.bind(thisArg);
        for (const [index, value] of this.entries()) {
            if (!boundP(value, index, this))
                return index;
        }
        return -1;
    }

    public findLast(p: (value: T, index: number, self: FixedSparseArrayLike<T>) => unknown, thisArg?: any): T|undefined {
        const boundP = p.bind(thisArg);
        for (let i = this.length - 1; i >= 0; i--) {
            const value = this[i];
            if (value !== undefined && boundP(value, i, this))
                return value;
        }
        return undefined;
    }

    public findLastIndex(p: (value: T, index: number, self: FixedSparseArrayLike<T>) => unknown, thisArg?: any): number {
        const boundP = p.bind(thisArg);
        for (let i = this.length - 1; i >= 0; i--) {
            const item = this[i];
            if (item !== undefined && boundP(item, i, this))
                return i;
        }
        return -1;
    }

    public forEach(f: (value: T, index: number, self: FixedSparseArrayLike<T>) => unknown, thisArg?: any): void {
        Array.prototype.forEach.call(this, f as any, thisArg);
    }

    public *keys(): IterableIterator<number> {
        for (let i = 0; i < this.length; i++) {
            if (this.#ops.has(i))
                yield i;
        }
    }

    public map<T>(f: (value: T, index: number, self: FixedSparseArrayLike<T>) => T, thisArg?: any): T[] {
        return Array.prototype.map.call(this, f as any, thisArg) as T[];
    }

    /** `pop()` works differently from `Array.prototype.pop()`. It returns
     * the last element of the array and leave a hole behind. Since the
     * array have a fixed size, it will not change the value of {@link
     * length}.
     */
    public pop(): T|undefined {
        for (let i = this.length - 1; i >= 0; i--) {
            const value = this[i];
            if (value !== undefined) {
                delete this[i];
                return value;
            }
        }
        return undefined;
    }

    /** `push()` works differently from `Array.prototype.push()`. It places
     * values in holes following the last element of the container, and
     * returns an array of values that couldn't be placed. Since the array
     * has a fixed size, it will not change the value of {@link length}.
     */
    public push(...values: T[]): T[] {
        for (let i = this.length; i >= 0; i--) {
            if (this.#ops.has(i)) {
                i++;
                let j = 0;
                for (; j < values.length; j++, i++)
                    this[i] = values[j]!
                return values.slice(j + 1);
            }
        }
        return values;
    }

    public reduce(f: (acc: T, value: T, index: number, self: FixedSparseArrayLike<T>) => T): T;
    public reduce<Acc>(f: (acc: Acc, value: T, index: number, self: FixedSparseArrayLike<T>) => Acc, init: Acc): Acc;
    public reduce(f: any, init?: any) {
        return Array.prototype.reduce.call(this, f, init);
    }

    public reduceRight(f: (acc: T, value: T, index: number, self: FixedSparseArrayLike<T>) => T): T;
    public reduceRight<Acc>(f: (acc: Acc, value: T, index: number, self: FixedSparseArrayLike<T>) => Acc, init: Acc): Acc;
    public reduceRight(f: any, init?: any) {
        return Array.prototype.reduceRight.call(this, f, init);
    }

    public reverse(): this {
        Array.prototype.reverse.call(this);
        return this;
    }

    /** `shift()` works differently from `Array.prototype.shift()`. It
     * returns the first element and leaves a hole beind. Since containers
     * have a fixed size, it will not change the value of {@link length}.
     */
    public shift(): T|undefined {
        for (let i = 0; i < this.length; i++) {
            const value = this[i];
            if (value !== undefined) {
                delete this[i];
                return value;
            }
        }
        return undefined;
    }

    public slice(start?: number, end?: number): T[] {
        return Array.prototype.slice.call(this, start, end);
    }

    public some(p: (value: T, index: number, self: FixedSparseArrayLike<T>) => unknown, thisArg?: any): boolean {
        const boundP = p.bind(thisArg);
        for (const [index, value] of this.entries()) {
            if (boundP(value, index, this))
                return true;
        }
        return false;
    }

    public sort(cmp?: (a: T, b: T) => number): this {
        Array.prototype.sort.call(this, cmp);
        return this;
    }

    public splice(start: number, deleteCount?: number): T[];
    public splice(start: number, deleteCount: number, ...items: T[]): T[];
    public splice(...args: any[]) {
        // @ts-ignore: TypeScript can't prove this is well-typed.
        return Array.prototype.splice.apply(this, args);
    }

    /** `unshift()` works differently from `Array.prototype.unshift()`. It
     * places values in holes preceding the first element of the container,
     * and returns an array of values that couldn't be placed. Since
     * containers have a fixed size, it will not change the value of {@link
     * length}.
     */
    public unshift(...values: T[]): T[] {
        for (let i = 0; i < this.length; i++) {
            if (this.#ops.has(i)) {
                i -= values.length;
                const numSkipped = -i;
                i = Math.max(i, 0);
                for (let j = numSkipped; j < values.length; j++, i++)
                    this[i] = values[j]!
                return values.slice(0, numSkipped);
            }
        }
        return values;
    }

    public *values(): IterableIterator<T> {
        for (let i = 0; i < length; i++) {
            const value = this[i];
            if (value !== undefined)
                yield value;
        }
    }
}
