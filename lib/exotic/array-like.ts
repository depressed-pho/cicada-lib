import { Constructor } from "../mixin.js";
import { getProxiedProperty, setProxiedProperty } from "./utils.js";

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

/** A mixin for classes behaving like a fixed-length sparse array.
 */
export function FixedSparseArrayLike<T, Base extends Constructor<any>>(base: Base) {
    abstract class FixedSparseArrayLike extends base {
        // THINKME: We can't declare this accessor here due to this
        // TypeScript bug:
        // https://github.com/microsoft/TypeScript/issues/54879
        //public abstract get length(): number;
        [index: number]: T;

        // These should actually be protected but TypeScript doesn't allow that.
        abstract "get"(index: number): T|undefined;
        abstract "set"(index: number, value: T): void;
        abstract "delete"(index: number): void;
        abstract keys(): IterableIterator<number>;
        "has"(index: number): boolean {
            return this.get(index) !== undefined;
        }

        public constructor(...args: any[]) {
            super(...args);
            // The dark side of JavaScript magic... We return an object
            // from the constructor that looks like a Container but is
            // actually not. This is necessary to override the behaviour of
            // obj[idx] notation.
            return new Proxy(this, {
                defineProperty(self: FixedSparseArrayLike, key: PropertyKey, desc: PropertyDescriptor): boolean {
                    if (toArrayIndex(key) !== undefined) {
                        // We are unwilling to allow this, otherwise we
                        // would need to do more work in "get" and "set"
                        // handlers.
                        return false;
                    }
                    else {
                        Object.defineProperty(self, key, desc);
                        return true;
                    }
                },
                deleteProperty(self: FixedSparseArrayLike, key: PropertyKey): boolean {
                    const index = toArrayIndex(key);
                    if (index === undefined) {
                        return false; // Can't delete non-index properties.
                    }
                    else {
                        self.delete(index);
                        return true;
                    }
                },
                "get"(self: FixedSparseArrayLike, key: PropertyKey, receiver: any): any {
                    const index = toArrayIndex(key);
                    if (index === undefined)
                        return getProxiedProperty(self, key, receiver, FixedSparseArrayLike);
                    else
                        return self.get(index);
                },
                getOwnPropertyDescriptor(self: FixedSparseArrayLike, key: PropertyKey): PropertyDescriptor|undefined {
                    const index = toArrayIndex(key);
                    if (index === undefined) {
                        return Object.getOwnPropertyDescriptor(self, key);
                    }
                    else {
                        const value = self.get(index);
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
                has(self: FixedSparseArrayLike, key: PropertyKey): boolean {
                    const index = toArrayIndex(key);
                    if (index === undefined)
                        return key in (self as any);
                    else
                        return self.has(index);
                },
                ownKeys(self: FixedSparseArrayLike): (string|symbol)[] {
                    const keys = Reflect.ownKeys(self);
                    for (const index of self.keys()) {
                        keys.push(String(index));
                    }
                    return keys;
                },
                "set"(self: FixedSparseArrayLike, key: PropertyKey, value: any, receiver: any): boolean {
                    const index = toArrayIndex(key);
                    if (index === undefined)
                        setProxiedProperty(self, key, value, receiver, FixedSparseArrayLike);
                    else
                        self.set(index, value);
                    return true;
                }
            });
        }
    }
    return FixedSparseArrayLike;
}
