import { OrdMap } from "../collections/ordered-map.js";
import { OrdSet } from "../collections/ordered-set.js";
import { Queue } from "../collections/queue.js";
import { constant } from "../function.js";
import { Index, Indices, KeyPath, equalKeyPaths, parseKeyPath } from "./schema.js";
import { Key, KeyRange, SINGLETON, MIN_KEY, MAX_KEY, cloneKey, inspectKey,
         compareKeys, equalKeys, extractKey, extractKeys, setValueAtPath,
         readKey, writeKey } from "./key.js";
import { type Storable, cloneStorable, readStorable, writeStorable } from "./storable.js";
import { TxnId, Transaction } from "./transaction.js";
import { WhereClause } from "./where-clause.js";
import type { Database } from "../database.js";
import * as PB from "./table_pb.js";

// Our database uses MVTO, append-only storage (N2O), transaction-level GC,
// logical pointer indices (PKey):
// http://www.vldb.org/pvldb/vol10/p781-Wu.pdf

/// The name of a table.
export type TableId = string;

/// @internal
export interface RowVersion<T> {
    /** A write lock: when this field has a value, it means the version has
     * been created by a transaction which hasn't ended yet. No other
     * transactions may access the version.
     */
    writer?: TxnId;
    /** The last transaction that read this version.
     */
    lastReader: TxnId;
    /** The lifetime of the version: [begin, end)
     */
    begin: TxnId;
    end: TxnId;
    /** The stored object, or `undefined` if it's been deleted.
     */
    obj?: T
}

/// Package private: user code should not use this.
export type RangeOf = (k: Key) => KeyRange;

/// Package private: user code should not use this. Oh hey, this is a
/// rank-2 type! It's surprising you can do it in TypeScript!
export type Matcher = <R>(rangeOf: RangeOf, map: OrdMap<Key, R>) => Iterable<[Key, R]>;

type UpdateResult<T>
    = { // No objects with the same primary key exist.
    }
    | { // The table has an intrinsic primary key, and the update function
        // changed the primary key.
        oldPKey: Key,
        newPKey: Key,
        newObj:  T
    }
    | { // Other cases. If `newObj` is undefined it means the object has
        // been deleted. This isn't the same as the pkey-not-found case.
        pKey:   Key,
        newObj: T|undefined
    };

/** Package private: user code should not use this. The class `TableStore` is
 * where the actual objects are stored. Objects are always accessed in a
 * transaction via {@link TableProxy}.
 */
export class TableStore<T> {
    readonly id: TableId;
    readonly #schema: Indices;
    // Very little is statically known about the type of this map. The key
    // is actually determined by the shape of the primary key, which is an
    // array if the primary key is compound, or a scalar value if it's
    // not. Invariant: each transaction has at most one uncommitted version
    // in a single row.
    readonly #rows: OrdMap<Key, Queue<RowVersion<T>>>;
    // Secondary indices never have false-negatives but may have
    // false-positives because they contain pointers to uncommitted rows
    // and un-gc'ed rows too. The values of #indices are maps from the
    // indexed key to the set of primary keys.
    readonly #indices: Map<Index, OrdMap<Key, OrdSet<Key>>>;

    public constructor(id: TableId, schema: Indices) {
        this.id       = id;
        this.#schema  = schema;
        this.#rows    = new OrdMap(compareKeys);
        this.#indices = new Map();

        for (const idx of this.#schema.indices) {
            this.#indices.set(idx, new OrdMap(compareKeys));
        }
    }

    get #hasIntrinsicPKey(): boolean {
        return this.#schema.pKey.index.keyPaths.length > 0;
    }

    get #isPKeyAutoIncr(): boolean {
        return this.#schema.pKey.isAutoIncr;
    }

    // Assumes the table has an auto-incremented primary key. Modifies the
    // `obj` if the key is intrinsic.
    #nextPKey(obj: T): Key {
        const max = this.#rows.maximum();
        const key = max ? (max[0] as number) + 1 : 0;
        if (this.#hasIntrinsicPKey) {
            setValueAtPath(this.#schema.pKey.index.keyPaths[0]!, key, obj);
        }
        return key;
    }

    // Modifies the `obj` if the key is auto-incremented and intrinsic. Use
    // this with care.
    getPKey(obj: T, pKey?: Key): Key {
        if (obj == undefined) {
            throw new Error("`undefined' is not a valid object to store in a table");
        }

        if (pKey == undefined) {
            if (this.#isPKeyAutoIncr) {
                return this.#nextPKey(obj);
            }
            else if (this.#hasIntrinsicPKey) {
                return extractKey(this.#schema.pKey.index, obj);
            }
            else {
                throw new Error(`The table ${this.id} has an extrinsic primary key but a key was not provided externally`);
            }
        }
        else {
            if (this.#isPKeyAutoIncr) {
                throw new Error(`The table ${this.id} has an auto-incremented primary key but ${inspectKey(pKey)} was externally provided`);
            }
            else if (this.#hasIntrinsicPKey) {
                throw new Error(`The table ${this.id} has an intrinsic primary key but ${inspectKey(pKey)} was externally provided`);
            }
            else {
                return cloneKey(pKey);
            }
        }
    }

    #index(tid: TxnId, pKey: Key, obj: T): void {
        try {
            for (const [idxSchema, index] of this.#indices) {
                // Things get complicated in the presence of multi-entry
                // indices. We need to break the key into pieces and insert
                // them all to the same index.
                for (const key of extractKeys(idxSchema, obj)) {
                    const pKeys0 = index.get(key);
                    if (!pKeys0) {
                        // No primary keys exist for this key. We can
                        // definitely insert one.
                        index.set(key, new OrdSet([pKey], compareKeys));
                    }
                    else {
                        // If it's a unique index we need to validate its
                        // uniqueness here.
                        if (idxSchema.isUnique && !pKeys0.has(pKey)) {
                            // If there are any primary keys in the set
                            // that are visible to this transaction, it
                            // means uniqueness is being violated.
                            for (const pKey0 of pKeys0) {
                                const obj0 = this.#unsafeGet(tid, pKey0);
                                if (obj0 !== undefined) {
                                    // It's visible indeed, but is the
                                    // reference still valid? If it's a
                                    // dangling one we can safely ignore
                                    // it.
                                    for (const key0 of extractKeys(idxSchema, obj0)) {
                                        if (equalKeys(key0, key)) {
                                            throw new UniquenessViolationError(
                                                `The table ${this.id} already has a value with the key ${String(key)}`);
                                        }
                                    }
                                }
                            }
                        }
                        pKeys0.add(pKey);
                    }
                }
            }
        }
        catch (e) {
            // When an error occurs while inserting entries to indices,
            // there is a chance that some dangling entries are left
            // behind. We must get rid of them.
            this.#unindex(obj);
            throw e;
        }
    }

    #unindex(obj: T): void {
        for (const [idxSchema, index] of this.#indices) {
            // Things get complicated in the presence of multi-entry
            // indices. We need to break the key into pieces and remove
            // them all from the same index.
            for (const key of extractKeys(idxSchema, obj)) {
                index.update(key, pKeys => {
                    // For each primary key in the set, check if there is
                    // still a version whose object is entitled to have an
                    // entry in this index, regardless of whether the
                    // version is a comitted one or not.
                    for (const pKey of pKeys) {
                        let found = false;
                        scanVers:
                        for (const ver of this.#rows.get(pKey) ?? Queue.empty) {
                            if (ver.obj === undefined)
                                continue;
                            for (const k of extractKeys(idxSchema, ver.obj)) {
                                if (equalKeys(key, k)) {
                                    found = true;
                                    break scanVers;
                                }
                            }
                        }
                        if (found)
                            pKeys.delete(pKey);
                    }
                    if (pKeys.size === 0)
                        // There are no more primary keys that are
                        // referenced by this key. Delete the set itself.
                        return undefined;
                    else
                        return pKeys;
                });
            }
        }
    }

    /** Revoke an uncommitted row. */
    public revoke(tid: TxnId, pKey: Key): void {
        const vers = this.#rows.get(pKey);
        if (!vers)
            // No versions exist for this key. There is no way we can
            // revoke anything.
            throw new Error(
                `Internal error: the table ${this.id} has no versions for the primary key ${String(pKey)}`);

        const [vs1, vs2] = vers.breakl(ver => ver.writer == tid);
        if (vs2.isEmpty)
            throw new Error(
                `Internal error: the table ${this.id} does not have a version ${tid} for the primary key ${String(pKey)}`);
        else if (vs1.isEmpty && vs2.length == 1)
            this.#rows.delete(pKey);
        else
            this.#rows.set(pKey, vs1.concat(vs2.drop(1)));

        // Revoking versions may leave dangling pointers in secondary
        // indices. We must get rid of them.
        if (vs2.head.obj !== undefined)
            this.#unindex(vs2.head.obj);
    }

    /** Mark an uncommitted row as committed. */
    public settle(tid: TxnId, pKey: Key): void {
        const vers = this.#rows.get(pKey);
        if (vers === undefined) {
            // No versions exist for this primary key. There is no way we
            // can settle anything.
            throw new Error(
                `Internal error: the table ${this.id} has no versions for the primary key ${String(pKey)}`);
        }

        // We are supposed to have write-locked the row, meaning that no
        // one else have inserted a new version. It must still be the
        // latest one.
        const [latest, rest] = vers.uncons();
        if (latest.writer !== tid) {
            throw new Error(
                `Internal error: the latest row version for the primary key ` +
                    `${String(pKey)} of the table ${this.id} isn't `+
                    `write-locked by the transaction ${tid}`);
        }
        delete latest.writer; // Remove its write-lock.

        // If there was an older version for the primary key, mark it as
        // expired.
        if (!rest.isEmpty) {
            rest.head.end = tid;
        }
    }

    /** Perform a GC on a set of rows. */
    public async gc(supremum: TxnId, pKeys: Iterable<Key>): Promise<void> {
        for (const pKey of pKeys) {
            const vers = await this.#rows.get(pKey);
            if (vers) {
                // Keep versions whose `.end` is larger than `supremum`,
                // and delete everything else. We don't have to worry about
                // write-locked ones, because their `.end` is always
                // Infinity. If that leaves no versions either write-locked
                // or having `.obj`, then we delete the entire row because
                // it means no one needs the deletion mark anymore.
                const [remnant, collected] = vers.partition(ver => ver.end > supremum);

                if (remnant.any(ver => ver.writer !== undefined || ver.obj !== undefined))
                    this.#rows.set(pKey, remnant);
                else
                    this.#rows.delete(pKey);

                // For GC-ed rows we need to remove them from the secondary
                // indices as well.
                for (const ver of collected) {
                    if (ver.obj !== undefined)
                        this.#unindex(ver.obj);
                }
            }
        }
    }

    /** Add a row that came from a snapshot. This doesn't clone the
     * object. Only use it for that.
     */
    public unsafeAddRow(row: PB.Row): void {
        const obj  = readStorable(row.value!);
        const pKey = readKey(row.pKey!);
        this.unsafeAdd(0, obj as T, pKey);
    }

    /** Add an uncommitted row for a given key. If an object with the same
     * primary key already exist, the operation throws {@link
     * UniquenessViolationError}. If the key has been write-locked by any
     * other transactions than `tid`, or if its absence has been observed
     * by any newer transactions, it throws {@link WriteConflictError}.
     *
     * This method is unsafe because it doesn't clone either `obj` or
     * `pKey`. Callers must do it on their own.
     */
    public unsafeAdd(tid: TxnId, obj: T, pKey: Key): void {
        this.#rows.alter(pKey, vers => {
            const ver = {
                writer:     tid,
                lastReader: 0,
                begin:      tid,
                end:        Infinity,
                obj
            };
            if (!vers) {
                // No versions exist for this primary key. We can
                // definitely insert one.
                return Queue.singleton(ver);
            }
            else {
                const latest = vers.head;
                if (latest.writer && latest.writer !== tid) {
                    // Someone else has inserted, updated, or deleted an
                    // object but they haven't committed yet.
                    throw new WriteConflictError();
                }
                else if (latest.lastReader > tid) {
                    // A newer transaction has observed this object, or
                    // possibly its absence.
                    throw new WriteConflictError();
                }
                else if (latest.obj !== undefined) {
                    throw new UniquenessViolationError(
                        `The table ${this.id} already has a value for the key ${String(pKey)}`);
                }
                else {
                    return vers.cons(ver);
                }
            }
        });

        // Add it to the secondary indices as well. It may throw
        // UniquenessViolationError and leave a dangling version in
        // #rows. In that case we must get rid of it.
        try {
            this.#index(tid, pKey, obj);
        }
        catch (e) {
            this.revoke(tid, pKey);
            throw e;
        }
    }

    /** Iterate over rows visible to a transaction. This operation never throws.
     *
     * Caution: This operation read-locks rows that are observed, but does
     * not read-lock gaps. There is currently no such thing as gap lock in
     * this database system. This means transactions older than `tid` can
     * freely insert new rows after the iteration happens without being
     * rejected as a conflicting write.
     */
    public *entries(tid: TxnId): IterableIterator<[Key, T]> {
        for (const [pKey, ver] of this.#unsafeSnapshot(tid)) {
            ver.lastReader = Math.max(ver.lastReader, tid);
            if (ver.obj !== undefined) {
                yield [cloneKey(pKey), cloneStorable(ver.obj)];
            }
        }
    }

    /** Obtain a snapshot of the table, visible to the given transaction.
     */
    *#unsafeSnapshot(tid: TxnId): IterableIterator<[Key, RowVersion<T>]> {
        for (const [pKey, vers] of this.#rows) {
            for (const ver of vers) {
                if (ver.begin <= tid && ver.end > tid) {
                    // Found a version that we can potentially read.
                    if (!ver.writer || ver.writer == tid) {
                        // It's not write-locked by anyone else. Read it,
                        // but don't read-lock it.
                        yield [pKey, ver];
                        // Primary keys are always unique. Ignore the
                        // remaining versions.
                        break;
                    }
                }
            }
        }
    }

    /** Retrieve an object whose primary key matches `key`. Return
     * `undefined` if no such key exists in the table. Uncommitted versions
     * made by other transactions than `tid` are treated as though they
     * didn't exist. This operation never throws.
     */
    public "get"(tid: TxnId, pKey: Key): T|undefined {
        const obj = this.#unsafeGet(tid, pKey);
        return obj ? cloneStorable(obj) : undefined;
    }

    #unsafeGet(tid: TxnId, pKey: Key): T|undefined {
        for (const ver of this.#rows.get(pKey) ?? Queue.empty) {
            if (ver.begin <= tid && ver.end > tid) {
                // Found a version that we can potentially read.
                if (!ver.writer || ver.writer == tid) {
                    // It's not write-locked by anyone else. Read it.
                    ver.lastReader = Math.max(ver.lastReader, tid);
                    return ver.obj !== undefined
                        ? cloneStorable(ver.obj)
                        : undefined;
                }
            }
        }
        return undefined;
    }

    /** Apply a function `f` to an existing object and add an uncommitted
     * updated version for a given key. If no object with the same primary
     * key exist, the function returns an empty array. If the table has an
     * intrinsic primary key, and `f` changes the primary key, then
     * `update()` returns an array of both the old and the new primary
     * key. Otherwise it returns a singleton array of the primary key.
     */
    public update(tid: TxnId, pKey: Key, f: (obj: T) => T|undefined): UpdateResult<T> {
        const vers = this.#rows.get(pKey);
        if (!vers) {
            // No versions exist for this primary key. We can definitely
            // not update anything.
            return {};
        }

        const latest = vers.head;
        if (latest.writer && latest.writer !== tid) {
            // Someone else has inserted, updated, or deleted an object but
            // they haven't committed it yet. We must not make any changes
            // to it.
            throw new WriteConflictError();
        }
        else if (latest.lastReader > tid) {
            // A newer transaction has observed this object, or
            // possibly its absence.
            throw new WriteConflictError();
        }
        else if (latest.obj === undefined) {
            // It's either a committed deletion mark which hasn't been
            // garbage-collected yet, or an uncommitted deletion mark made
            // by the same transaction. Ignore it either way.
            return {};
        }
        else {
            pKey = cloneKey(pKey);
            let updated = f(cloneStorable(latest.obj));
            if (updated) {
                // The user wants it to be updated.
                updated = cloneStorable(updated);
                if (this.#hasIntrinsicPKey) {
                    let newPKey = extractKey(this.#schema.pKey.index, updated);
                    if (equalKeys(newPKey, pKey)) {
                        // The fast path: its primary key is unchanged.
                        this.#rows.set(pKey, vers.cons({
                            writer:     tid,
                            lastReader: 0,
                            begin:      tid,
                            end:        Infinity,
                            obj:        updated
                        }));
                        // But re-indexing the row may throw
                        // UniquenessViolationError and leave a dangling
                        // version in #rows. In that case we must get rid
                        // of it.
                        try {
                            this.#index(tid, pKey, updated);
                            return {
                                pKey,
                                newObj: updated
                            };
                        }
                        catch (e) {
                            this.revoke(tid, pKey);
                            throw e;
                        }
                    }
                    else {
                        // The slow path: its primary key is changed. We
                        // must delete the old row and insert a new one.
                        this.#rows.set(pKey, vers.cons({
                            writer:     tid,
                            lastReader: 0,
                            begin:      tid,
                            end:        Infinity
                        }));
                        // But inserting a new row may violate uniqueness.
                        newPKey = cloneKey(newPKey);
                        try {
                            this.unsafeAdd(tid, updated, newPKey);
                            return {
                                oldPKey: pKey,
                                newPKey,
                                newObj:  updated
                            };
                        }
                        catch (e) {
                            this.revoke(tid, pKey);
                            throw e;
                        }
                    }
                }
                else {
                    // The table has an extrinsic primary key. Changing the
                    // key is impossible.
                    this.#rows.set(pKey, vers.cons({
                        writer:     tid,
                        lastReader: 0,
                        begin:      tid,
                        end:        Infinity,
                        obj:        updated
                    }));
                    // But re-indexing the row may throw
                    // UniquenessViolationError and leave a dangling
                    // version in #rows. In that case we must get rid of
                    // it.
                    try {
                        this.#index(tid, pKey, updated);
                        return {
                            pKey,
                            newObj: updated
                        };
                    }
                    catch (e) {
                        this.revoke(tid, pKey);
                        throw e;
                    }
                }
            }
            else {
                // The user wants it to be deleted. In this case we don't
                // need to do anything about secondary indices.
                this.#rows.set(pKey, vers.cons({
                    writer:     tid,
                    lastReader: 0,
                    begin:      tid,
                    end:        Infinity
                }));
                return {
                    pKey,
                    newObj: undefined
                };
            }
        }
    }

    /** Add an uncommitted deletion mark for a given key. If no object with
     * the same primary key exist, the function returns `undefined`. If the
     * key has been write-locked by any other transactions than `tid`, or
     * if its absence has been observed by any newer transactions, it
     * throws {@link WriteConflictError}. Otherwise it returns a clone of
     * `pKey`.
     */
    public "delete"(tid: TxnId, pKey: Key): Key|undefined {
        const vers = this.#rows.get(pKey);
        if (vers) {
            const latest = vers.head;
            if (latest.writer && latest.writer !== tid) {
                // Someone else has inserted, updated, or deleted an
                // object but they haven't committed yet.
                throw new WriteConflictError();
            }
            else if (latest.lastReader > tid) {
                // A newer transaction has observed this object, or
                // possibly its absence. If it's a deletion mark we can
                // safely ignore it, because deleting an already deleted
                // row is a no-op.
                if (latest.obj !== undefined)
                    throw new WriteConflictError();
            }
            else if (latest.obj === undefined) {
                // It's either a committed deletion mark which hasn't been
                // garbage-collected yet, or an uncommitted deletion mark
                // made by the same transaction. Ignore it either way.
            }
            else {
                pKey = cloneKey(pKey);
                this.#rows.set(pKey, vers.cons({
                    writer:     tid,
                    lastReader: 0,
                    begin:      tid,
                    end:        Infinity
                }));
                return pKey;
            }
        }
        return undefined;
    }

    /// Package private: user code should not use this.
    public *match(tid: TxnId,
                  idxRef: string|string[],
                  matcher: Matcher): IterableIterator<[Key, T]> {
        if (idxRef == ":id") {
            yield* this.#matchPKey(tid, matcher, constant(SINGLETON));
        }
        else {
            const rangeOfPKey = mkRangeOf(idxRef, this.#schema.pKey.index);
            if (rangeOfPKey) {
                yield* this.#matchPKey(tid, matcher, rangeOfPKey);
            }
            else {
                for (const [schema, idx] of this.#indices) {
                    const rangeOfIndex = mkRangeOf(idxRef, schema);
                    if (rangeOfIndex) {
                        yield* this.#matchIndex(tid, matcher, rangeOfIndex, schema, idx);
                        return;
                    }
                }
                // Reaching here means that no indices could serve this
                // query. We could perform a full table scan of course, but
                // we assume that's not what users want us to do.
                throw new Error(
                    `The table ${this.id} has no indices that can serve ` +
                        `queries on ${idxRefToStr(idxRef)}`);
            }
        }
    }

    *#matchPKey(tid: TxnId,
                matcher: Matcher,
                rangeOf: RangeOf): IterableIterator<[Key, T]> {
        for (const [pKey, vers] of matcher(rangeOf, this.#rows)) {
            for (const ver of vers) {
                if (ver.begin <= tid && ver.end > tid) {
                    // Found a version that we can potentially read.
                    if (!ver.writer || ver.writer == tid) {
                        // It's not write-locked by anyone else. Read it.
                        ver.lastReader = Math.max(ver.lastReader, tid);
                        if (ver.obj !== undefined) {
                            yield [cloneKey(pKey), cloneStorable(ver.obj)];
                        }
                        // Primary keys are always unique. Ignore the
                        // remaining versions.
                        break;
                    }
                }
            }
        }
    }

    *#matchIndex(tid: TxnId,
                 matcher: Matcher,
                 rangeOf: RangeOf,
                 schema: Index,
                 idx: OrdMap<Key, OrdSet<Key>>): IterableIterator<[Key, T]> {
        for (const [key, pKeys] of matcher(rangeOf, idx)) {
            // For each primary key in the set, check if there is still a
            // version visible to this transaction whose object is entitled
            // to have an entry in this index.
            scanPKeys:
            for (const pKey of pKeys) {
                const obj = this.get(tid, pKey);
                if (obj !== undefined) {
                    for (const k of extractKeys(schema, obj)) {
                        if (equalKeys(key, k)) {
                            yield [cloneKey(pKey), obj]; // obj is already cloned by get().
                            if (schema.isUnique)
                                // If it's a unique index there can be no
                                // more visible versions for the same
                                // key. We can safely ignore the remaining
                                // primary keys.
                                break scanPKeys;
                            else
                                // It's not a unique index, but we can
                                // still ignore the rest of extracted keys.
                                break;
                        }
                    }
                }
            }
        }
    }

    /** Iterate over rows of a snapshot of the table. Unlike `entries()`
     * this method does not read-lock rows. This means active transactions
     * older than `tid` can update rows.
     */
    public *snapshot(tid: TxnId): IterableIterator<PB.Row> {
        for (const [pKey, ver] of this.#unsafeSnapshot(tid)) {
            if (ver.obj !== undefined) {
                yield {
                    pKey:  writeKey(pKey),
                    value: writeStorable(ver.obj as Storable)
                }
            }
        }
    }
}

function idxRefToStr(idxRef: string|string[]): string {
    return (typeof idxRef === "string")
        ? idxRef
        : "[" + idxRef.join("+") + "]";
}

function mkRangeOf(idxRef: string|string[], schema: Index): RangeOf|undefined {
    const keyPaths =
        (typeof idxRef === "string" ? [idxRef] : idxRef).map(parseKeyPath);

    if (isPrefixOf(keyPaths, schema.keyPaths)) {
        if (keyPaths.length === schema.keyPaths.length) {
            // The whole index is being matched against.
            return constant(SINGLETON);
        }
        else {
            const numExtra = schema.keyPaths.length - keyPaths.length;
            if (typeof idxRef === "string") {
                // It's a compound index but the user is only interested in the
                // very first key.
                return (key: Key) => {
                    return {
                        min: [key].concat(new Array(numExtra).fill(MIN_KEY)) as Key,
                        max: [key].concat(new Array(numExtra).fill(MAX_KEY)) as Key
                    };
                };
            }
            else {
                // It's a compound index but the user is only interested in
                // the first few.
                return (key: Key) => {
                    if (Array.isArray(key)) {
                        return {
                            min: key.concat(new Array(numExtra).fill(MIN_KEY)),
                            max: key.concat(new Array(numExtra).fill(MAX_KEY)),
                        };
                    }
                    else {
                        throw new TypeError(`A compound key must always be an array: ${String(key)}`);
                    }
                };
            }
        }
    }
    else {
        return undefined;
    }
}

function isPrefixOf(a: KeyPath[], b: KeyPath[]): boolean {
    if (a.length > b.length) {
        return false;
    }
    else {
        for (let i = 0; i < a.length; i++) {
            if (!equalKeyPaths(a[i]!, b[i]!))
                return false;
        }
        return true;
    }
}

export class TableProxy<T> {
    readonly #db: Database;
    readonly #table: TableStore<T>;
    readonly #txn: Transaction|undefined;

    /// Package private: user code should not use this.
    public constructor(db: Database, tableId: TableId, txn?: Transaction) {
        this.#db    = db;
        this.#table = db.tableStore(tableId);
        this.#txn   = txn;
    }

    /** Return the number of objects in this table.
     */
    public async count(): Promise<number> {
        return this.#withTxn(async txn => {
            let count = 0;
            for await (const _kv of this.#table.entries(txn.id)) {
                count++;
            }
            return count;
        });
    }

    /** Add a row for a given key. If an object with the same primary key
     * already exist, the operation throws {@link
     * UniquenessViolationError}. Otherwise it returns the primary key of
     * the inserted object.
     *
     * If the primary key is extrinsic and isn't auto-incremented, the
     * optional `pKey` has to be provided. Otherwise it has to be omitted.
     */
    public async add(obj: T, pKey?: Key): Promise<Key> {
        obj  = cloneStorable(obj);
        pKey = this.#table.getPKey(obj, pKey);
        return this.#withTxn(async txn => {
            this.#table.unsafeAdd(txn.id, obj, pKey!);
            txn.rowUpdated(this.#table, pKey!, obj);
            return pKey!;
        });
    }

    /** Iterate over rows in the table.
     */
    public async *entries(): AsyncIterableIterator<[Key, T]> {
        const self = this;
        yield* this.#withTxnIter(async function* (txn) {
            yield* self.#table.entries(txn.id);
        });
    }

    /** Retrieve an object whose primary key matches `pKey`. Return
     * `undefined` if no such key exists in the table.
     */
    public async get(pKey: Key): Promise<T|undefined> {
        return this.#withTxn(async txn => this.#table.get(txn.id, pKey));
    }

    /** Update an object whose primary key matches `pKey`. Return `1` if
     * there is a matching key, or `0` otherwise. The update is performed
     * by applying a function for the object. If the function returns
     * `undefined`, the object will be deleted.
     *
     * It is also possible to update its primary key if it's intrinsic, but
     * it's an inefficient operation. Try to avoid that unless necessary.
     */
    public async update(pKey: Key, f: (obj: T) => T|undefined): Promise<0|1> {
        return this.#withTxn(async txn => {
            const result = this.#table.update(txn.id, pKey, f);
            if ("newObj" in result) {
                // The object has at least been found.
                if ("newPKey" in result) {
                    txn.rowUpdated(this.#table, result.oldPKey, undefined);
                    txn.rowUpdated(this.#table, result.newPKey, result.newObj);
                }
                else {
                    // Either updated in-place or deleted.
                    txn.rowUpdated(this.#table, result.pKey, result.newObj);
                }
                return 1;
            }
            else {
                return 0;
            }
        });
    }

    /** Delete an object whose primary key matches `pKey`. Return `1` if
     * there was a matching key, or `0` otherwise.
     */
    public async "delete"(pKey: Key): Promise<0|1> {
        return this.#withTxn(async txn => {
            const ret = this.#table.delete(txn.id, pKey);
            if (ret) {
                txn.rowUpdated(this.#table, ret, undefined);
                return 1;
            }
            else {
                return 0;
            }
        });
    }

    /** Create an instance of {@link WhereClause}. If the argument is a
     * string it is interpreted as the name of an index. If it's an array
     * it's interpreted as the name of a compound index. A special name
     * `:id` denotes the primary key.
     */
    public where(idxRef: string|string[]): WhereClause<T> {
        return new WhereClause<T>(this, idxRef);
    }

    /// @internal
    public async *match(idxRef: string|string[],
                        matcher: Matcher): AsyncIterableIterator<[Key, T]> {
        const self = this;
        yield* this.#withTxnIter(async function* (txn) {
            yield* self.#table.match(txn.id, idxRef, matcher);
        });
    }

    /// @internal
    public async countMatches(idxRef: string|string[],
                              matcher: Matcher): Promise<number> {
        return this.#withTxn(async txn => {
            let count = 0;
            for await (const _kv of this.#table.match(txn.id, idxRef, matcher)) {
                count++;
            }
            return count;
        });
    }

    /// @internal
    public async updateMatches(idxRef: string|string[],
                               matcher: Matcher,
                               f: (obj: T, pKey: Key) => T|undefined
                              ): Promise<number> {
        return this.#withTxn(async txn => {
            let count = 0;
            for await (const [pKey, _obj] of this.#table.match(txn.id, idxRef, matcher)) {
                const result = this.#table.update(txn.id, pKey, obj => f(obj, pKey));
                if ("newObj" in result) {
                    // The object has at least been found.
                    if ("newPKey" in result) {
                        txn.rowUpdated(this.#table, result.oldPKey, undefined);
                        txn.rowUpdated(this.#table, result.newPKey, result.newObj);
                    }
                    else {
                        txn.rowUpdated(this.#table, result.pKey, result.newObj);
                    }
                    count++;
                }
            }
            return count;
        });
    }

    /// @internal
    public async deleteMatches(idxRef: string|string[],
                               matcher: Matcher): Promise<number> {
        return this.#withTxn(async txn => {
            let count = 0;
            for await (const [pKey, _obj] of this.#table.match(txn.id, idxRef, matcher)) {
                const ret = this.#table.delete(txn.id, pKey);
                if (ret) {
                    txn.rowUpdated(this.#table, ret, undefined);
                    count++;
                }
            }
            return count;
        });
    }

    async #withTxn<R>(f: (txn: Transaction) => Promise<R>): Promise<R> {
        if (this.#txn) {
            if (!this.#txn.isActive) {
                throw new Error(`The transaction ${this.#txn.id} is no longer active`);
            }
            return await f(this.#txn);
        }
        else {
            while (true) {
                const txn = new Transaction(this.#db);
                try {
                    const ret = await f(txn);
                    await txn.commit();
                    return ret;
                }
                catch (e) {
                    await txn.abort();
                    if (!(e instanceof WriteConflictError)) {
                        throw e;
                    }
                }
            }
        }
    }

    async* #withTxnIter<R>(f: (txn: Transaction) => AsyncIterable<R>): AsyncIterableIterator<R> {
        if (this.#txn) {
            if (!this.#txn.isActive) {
                throw new Error(`The transaction ${this.#txn.id} is no longer active`);
            }
            yield* f(this.#txn);
        }
        else {
            while (true) {
                const txn = new Transaction(this.#db);
                try {
                    yield* f(txn);
                    await txn.commit();
                    return;
                }
                catch (e) {
                    await txn.abort();
                    if (!(e instanceof WriteConflictError)) {
                        throw e;
                    }
                }
            }
        }
    }
}

export class UniquenessViolationError extends Error {
    public constructor(msg: string) {
        super(msg);
    }
}

/// Package private: user code should not throw or catch this.
export class WriteConflictError extends Error {
    public constructor() {
        super("a write conflict has happened");
    }
}
