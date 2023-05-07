import { Key } from "./key.js";
import type { Matcher } from "./table.js";
import type { WhereClause } from "./where-clause.js";

export class Collection<T> implements AsyncIterable<[Key, T]> {
    readonly #where: WhereClause<T>;
    readonly #matcher: Matcher;

    public constructor(where: WhereClause<T>, matcher: Matcher) {
        this.#where   = where;
        this.#matcher = matcher;
    }

    /** Count the number of items. */
    public async count(): Promise<number> {
        return this.#where.proxy.countMatches(this.#where.idxRef, this.#matcher);
    }

    /** Iterate over primary key / object pairs. */
    public entries(): AsyncIterableIterator<[Key, T]> {
        return this.#iterate((k, v) => [k, v]);
    }

    /** Equivalent to {@link entries()}. */
    public [Symbol.asyncIterator](): AsyncIterableIterator<[Key, T]> {
        return this.entries();
    }

    /** Retrieve the first object in the collection, or `undefined` if no
     * objects exist.
     */
    public async first(): Promise<T|undefined> {
        const kv = await this.firstEntry();
        return kv ? kv[1] : undefined;
    }

    /** Retrieve the first key / object pair in the collection, or
     * `undefined` if no entries exist.
     */
    public async firstEntry(): Promise<[Key, T]|undefined> {
        for await (const kv of this.#where.proxy.match(this.#where.idxRef, this.#matcher)) {
            return kv;
        }
        return undefined;
    }

    /** Update all the items in the collection from the table, and return
     * the number of affected items. The update is performed by applying a
     * function for each item. If the function returns `undefined`, the
     * item will be deleted.
     *
     * It is also possible to update their primary keys if they are
     * intrinsic, but it's an inefficient operation. Try to avoid that
     * unless necessary.
     */
    public async update(f: (obj: T, pKey: Key) => T|undefined): Promise<number> {
        return this.#where.proxy.updateMatches(this.#where.idxRef, this.#matcher, f);
    }

    /** Delete all the items in the collection from the table, and return
     * the number of deleted items.
     */
    public async "delete"(): Promise<number> {
        return this.#where.proxy.deleteMatches(this.#where.idxRef, this.#matcher);
    }

    async *#iterate<R>(f: (k: Key, v: T) => R): AsyncIterableIterator<R> {
        for await (const [k, v] of this.#where.proxy.match(this.#where.idxRef, this.#matcher)) {
            yield f(k, v);
        }
    }
}
