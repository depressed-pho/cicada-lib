import { OrdMap } from "../collections/ordered-map.js";
import { type Database } from "../database.js";
import { type Storable } from "./storable.js";
import { Key, compareKeys } from "./key.js";
import { TableId, TableStore, TableProxy } from "./table.js";
import { DeletionMark } from "./wal.js";

/** Cannot go beyond 2^53 - 1 (`Number.MAX_SAFE_INTEGER`). We can't use
 * BigInt atm because the Bedrock API has not enabled it.
 */
export type TxnId = number;

export enum TxnState {
    ONGOING,
    ABORTED,
    COMMITTED
}

export class Transaction {
    static #nextTxnId: TxnId = 1;

    readonly db: Database;
    readonly id: number;
    #state: TxnState;
    /** The set of rows that the transaction updated (or
     * inserted/deleted). When a transaction is aborted we immediately
     * delete those uncommitted versions from the table. When it's
     * committed, and all of other transactions preceding it have ended, we
     * delete row versions whose lifetime has expired. The reason why we
     * use OrdMap<TableId, ...> where TableId is just a string because
     * we'll need to take a union later.
     */
    readonly #updated: OrdMap<TableId, OrdMap<Key, Storable|DeletionMark>>;

    /// Package private: user code should not use this.
    public constructor(db: Database) {
        if (Transaction.#nextTxnId >= Number.MAX_SAFE_INTEGER) {
            // More than 9 quadrillion transactions have happened during a
            // single run? Seriously?
            throw new Error("Reached the maximum transaction ID; a server restart is required to reset it");
        }
        this.db       = db;
        this.id       = Transaction.#nextTxnId++;
        this.#state   = TxnState.ONGOING;
        this.#updated = new OrdMap();

        // A constructor with a side effect... This is gross but no
        // transactions are valid if they aren't registered to the
        // database. Still better than keeping reminding ourselves to do
        // this after each and every "new Transaction()".
        db.txnBegan(this);
    }

    public get isActive(): boolean {
        return this.#state == TxnState.ONGOING;
    }

    /// @internal
    public get updatedRows(): OrdMap<TableId, OrdMap<Key, Storable|DeletionMark>> {
        return this.#updated;
    }

    /// @internal
    public rowUpdated<T>(table: TableStore<T>, pKey: Key, obj: T|undefined): void {
        let pKeys = this.#updated.get(table.id);
        if (!pKeys) {
            pKeys = new OrdMap(compareKeys);
            this.#updated.set(table.id, pKeys);
        }

        if (pKeys.has(pKey)) {
            // The transaction has created a version for the same primary
            // key more than once. Revoke the old one immediately.
            table.revoke(this.id, pKey);
        }
        pKeys.set(pKey, obj ?? DeletionMark);
    }

    /// Package private: user code should not use this.
    public async abort(): Promise<void> {
        for (const [tableId, rows] of this.#updated) {
            const table = this.db.tableStore(tableId);
            for (const pKey of rows.keys()) {
                await table.revoke(this.id, pKey);
            }
        }
        this.#state = TxnState.ABORTED;
        await this.db.txnEnded(this);
    }

    /// Package private: user code should not use this.
    public async commit(): Promise<void> {
        for (const [tableId, rows] of this.#updated) {
            const table = this.db.tableStore(tableId);
            for (const pKey of rows.keys()) {
                await table.settle(this.id, pKey);
            }
        }
        this.#state = TxnState.COMMITTED;
        await this.db.txnEnded(this);
    }

    /** Obtain a table handle that is bound to the transaction. Any data
     * written to the table will not be visible to other transactions until
     * it is committed. The type `T` denotes the type of objects stored in
     * the table. Note that `T` must satisfy `Storable` but this constraint
     * cannot be expressed in TypeScript due to
     * https://github.com/microsoft/TypeScript/issues/35164
     */
    public table<T>(id: TableId): TableProxy<T> {
        return new TableProxy(this.db, id, this);
    }
}
