import { Collection } from "./collection.js";
import { Key, SINGLETON } from "./key.js";
import type { TableProxy } from "./table.js";

export class WhereClause<T> {
    /// Package private: user code should not use this.
    readonly proxy: TableProxy<T>;
    /// Package private: user code should not use this.
    readonly idxRef: string|string[];

    /// Package private: user code should not use this.
    public constructor(proxy: TableProxy<T>, idxRef: string|string[]) {
        this.proxy  = proxy;
        this.idxRef = idxRef;
    }

    /** Return a collection of objects where the indexed values equal to
     * the given key.
     */
    public equals(key: Key): Collection<T> {
        return new Collection(this, function* (rangeOf, map) {
            const range = rangeOf(key);
            if (range === SINGLETON) {
                const matched = map.get(key);
                if (matched !== undefined) {
                    yield [key, matched];
                }
            }
            else {
                const [_l1, v1, r1] = map.split(range.min);
                if (v1 !== undefined) {
                    yield [range.min, v1];
                }

                const [l2, v2, _r2] = r1.split(range.max);
                yield* l2;
                if (v2 !== undefined) {
                    yield [range.max, v2];
                }
            }
        });
    }
}
