import "./shims/text-decoder.js";
import "./shims/text-encoder.js";
import { OrdSet } from "./collections/ordered-set.js";
import { awaitC, conduit, peekForeverE } from "./conduit.js";
import { Metadata, Side } from "./database/metadata.js";
import { DatabaseSaver } from "./database/saver.js";
import { readSnapshot, writeSnapshot } from "./database/snapshot.js";
import { TableId, TableStore, TableProxy, WriteConflictError } from "./database/table.js";
import { Transaction, TxnId } from "./database/transaction.js";
import { Version } from "./database/version.js";
import { WALChunk, WALEntry } from "./database/wal.js";
import { MAX_STRING_PROPERTY_LENGTH, sinkDynamicProperty,
         sourceDynamicProperty } from "./dynamic-props.js";
import { world } from "./world.js";

export { Transaction, Version };
export { IDatabaseSchema } from "./database/schema.js";
export { Storable } from "./database/storable.js";
export { UniquenessViolationError } from "./database/table.js";

let worldInitialised = false;
const databases = new Map<string, Database>();

/** This is like IndexedDB stored in Minecraft worlds. In order to use it,
 * you first declare databases on the top level of your script:
 *
 * @example
 * ```typescript
 * import { Database } from "cicada-lib/database.js";
 *
 * // DB with a single table "players" with primary key "id" and an index
 * // on a property "lastSeen". Rows in the table may have additional
 * // properties but they will just not be indexed.
 * const db = Database.declare("your-database");
 * db.version(1)
 *   .stores({
 *       players: "id, lastSeen"
 *   });
 * ```
 *
 * You can then access your databases in your event handlers:
 *
 * @example
 * ```typescript
 * world.events.playerSpawn.subscribe(ev => {
 *     const db = Database.get("your-namespace:your-database");
 *
 *     // Insert an object to the table, or overwrite an existing object
 *     // whose "id" is the same as this.
 *     db.table("players").put({
 *         id:       ev.player.id,
 *         name:     ev.player.name, // A non-indexed property
 *         lastSeen: new Date()
 *     });
 *
 *     // Do something to known players in reverse "lastSeen" order.
 *     for (const obj of db.table("players").orderBy("lastSeen").reverse()) {
 *         ...
 *     }
 * });
 * ```
 *
 * Here are implementation details. You surely don't want to read this, but
 * you really need to.
 *
 * The data is stored in per-world dynamic properties because it's the only
 * sensible way to do it. The problem is, you can only store data of up to
 * 32767 characters in a single dynamic property, and your property values
 * have to be valid Unicode strings but not arbitrary binary data. Dynamic
 * properties are also not transactional: you cannot update multiple
 * properties in an atomic manner, and if the game terminates while you're
 * updating several of them, your data of course gets corrupted.
 *
 * To overcome these limitations, what this library actually does is to
 * encode your databases in Protobuf, compress them with LZ4, apply Ascii85
 * to turn binary into ASCII characters, split them in "parts" with each
 * part consisting up to 32767 characters, and then store those parts in
 * multiple dynamic properties. Suppose you declare a database "foo". The
 * library creates the following dynamic properties on your world:
 *
 *   - "database.foo.meta"       For bookkeeping your database.
 *   - ...
 *   - "database.foo.part.A.0"  Data parts A, more on these below.
 *   - "database.foo.part.A.1"
 *   - "database.foo.part.A.2"
 *   - ...
 *   - "database.foo.wal.A.0"    Write-ahead logs for parts A, more on
 *   - "database.foo.wal.A.1"    these below.
 *   - "database.foo.wal.A.2"
 *   - ...
 *   - "database.foo.part.B.0"  Data parts B, more on these below.
 *   - "database.foo.part.B.1"
 *   - "database.foo.part.B.2"
 *   - ...
 *   - "database.foo.wal.B.0"    Write-ahead logs for parts B.
 *   - "database.foo.wal.B.1"
 *   - "database.foo.wal.B.2"
 *   - ...
 *
 * The database starts with the side A being active. When you insert an
 * object in one of tables in your database, the library tries to [1]
 * append the object in the latest WAL of the active side (A, in this case)
 * if possible, or [2] creates a new WAL and write the object in it. It
 * then spawns a background task that [3] splits the database in parts and
 * stores them as "parts B", [4] updates the metadata property with
 * information indicating that "parts B" is now active, and then [5]
 * deletes WALs of the side A. The next time you perform an insert, update,
 * or delete on your table, the updated database will be stored in "parts
 * B". This is to achieve durability, that is, once you commit a
 * transaction nothing can be lost even in the case of game crash.
 *
 * When the game starts up and the database is to be loaded, the library
 * loads the active parts and replays WAL entries if any.
 *
 * If the game crashes while in the process of [1] or [2], the transction
 * will be lost forever but it's fine because the caller of {@link
 * transaction} is still waiting for it to complete. If it crashes in [3],
 * the half-written parts will get corrupted but since WALs are intact and
 * the metadata is still pointing at the old parts, absolutely nothing get
 * lost. The step [4] is an atomic operation so crashes cannot corrupt
 * anything. If it crashes after [4] but before [5] completes, it means the
 * metadata now points at new parts and some WAL entries are now
 * obsolete. This is fine because the number of relevant WALs is also
 * recorded in metadata, and they can be safely ignored on the next
 * startup.
 *
 * The library currently does not store indices in the world. All the data,
 * including indices, are loaded in memory on world initialization, and the
 * storage will be updated every time you perform an update to your
 * databases. This means queries are very cheap but updates are not. Try
 * not to perform updates too frequently as that may cause server lag.
 */
export class Database {
    readonly #dbName: string;
    #meta: Metadata;
    readonly #tables: Map<TableId, TableStore<any>>;
    #txns: OrdSet<Transaction>;
    #newestCommittedTid: TxnId;
    readonly #saver: DatabaseSaver;

    public static declare(dbName: string): Database {
        if (worldInitialised) {
            throw new Error(
                "Attempted to declare a database after initialising the world. It's too late");
        }
        else if (databases.has(dbName)) {
            throw new Error(`Database ${dbName} has already been declared`);
        }
        else {
            const db = new Database(dbName);
            databases.set(dbName, db);
            return db;
        }
    }

    private constructor(dbName: string) {
        this.#dbName             = dbName;
        this.#meta               = new Metadata();
        this.#tables             = new Map();
        this.#txns               = new OrdSet((a, b) => a.id - b.id);
        this.#newestCommittedTid = 0;
        this.#saver              = new DatabaseSaver(this).start();
    }

    get #propMeta(): string {
        return "database." + this.#dbName + ".meta";
    }

    #propPart(side: Side, num: number): string {
        switch (side) {
            case Side.A: return "database." + this.#dbName + ".part.A." + num;
            case Side.B: return "database." + this.#dbName + ".part.B." + num;
        }
    }

    #propWAL(side: Side, num: number): string {
        switch (side) {
            case Side.A: return "database." + this.#dbName + ".wal.A." + num;
            case Side.B: return "database." + this.#dbName + ".wal.B." + num;
        }
    }

    /// @internal
    public async txnBegan(txn: Transaction): Promise<void> {
        this.#txns.add(txn);
    }

    /// @internal
    public async txnEnded(txn: Transaction): Promise<void> {
        const [olderTxns, hasSelf, newerTxns] = this.#txns.split(txn);

        if (txn.isActive) {
            throw new Error(`Internal error: ${txn} is still active`);
        }
        else if (!hasSelf) {
            throw new Error(`Internal error: transaction ${txn.id} is not in the queue`);
        }

        // If anything is updated, serialise tables and store them to the
        // world. This can be a costly operation so we need to do it in a
        // separate thread, otherwise we may trigger a watchdog.
        if (txn.updatedRows.size > 0) {
            this.#newestCommittedTid = Math.max(this.#newestCommittedTid, txn.id);
            this.#writeWAL(txn);
            this.#saver.schedule();
        }

        if (olderTxns.any(older => older.isActive)) {
            // There is an older transaction that is still active. We
            // cannot delete expired versions right now, because they
            // might still depend on them.
            return;
        }

        // There are no active transactions that are older than `txn`. We
        // can delete versions created by this transaction whose lifetime
        // has ended before its birth (i.e. their `.end` is no larger than
        // `txn.id`, because newer transactions would never depend on
        // them. The same goes for versions created by older transactions.
        let rowsToGC = txn.updatedRows;
        for (const older of olderTxns) {
            rowsToGC = rowsToGC.union(older.updatedRows, (ksA, ksB) => ksA.union(ksB));
        }

        for (const [tableId, rows] of rowsToGC) {
            await this.tableStore(tableId).gc(txn.id, rows.keys());
        }

        // Now we can forget about GC'ed transactions.
        this.#txns = newerTxns;
    }

    /// Module private: do not use this outside of this module.
    public async load(): Promise<void> {
        if (this.#meta.versions.size == 0) {
            throw new Error(
                `No versions have been declared for the database \`${this.#dbName}'. You need to declare at least one`);
        }

        const storedMetaStr = world.getDynamicProperty(this.#propMeta, "string?");
        if (storedMetaStr === undefined) {
            // The database didn't exist. Initialise it.
            this.#initialise();
            return;
        }

        try {
            const storedMeta = new Metadata(storedMetaStr);

            const parts = storedMeta.activeParts;
            let version = storedMeta.versions.get(parts.version);
            if (!version) {
                // FIXME: Don't throw an error. Use the newest schema older
                // than parts.version.
                throw new Error(`FIXME: version not found: ${parts.version}`);
            }

            if (storedMeta.versions.maximum()![0] > parts.version) {
                // FIXME: Support DB version upgrading.
                throw new Error(`FIXME: database needs upgrading: ${parts.version}`);
            }

            const self = this;
            await sourceDynamicProperty(
                world,
                parts.numChunks,
                i => self.#propPart(parts.side, i))
                .fuse(readSnapshot(version.schema))
                .fuse(peekForeverE(conduit(function* () {
                    const table = yield* awaitC;
                    self.#tables.set(table.id, table);
                })))
                .runAsync();
            // FIXME: Read WAL

            this.#meta = storedMeta;
        }
        catch (e) {
            console.error(`The metadata for the database ${this.#dbName} is corrupted. We have no choice but to clear it: ${e}`);
            this.#initialise();
        }
    }

    #initialise() {
        const latestSchema = this.#meta.versions.maximum()![1].schema;
        for (const [tableId, indices] of latestSchema) {
            this.#tables.set(tableId, new TableStore(tableId, indices));
        }
    }

    #readLastWALChunk(): WALChunk|undefined {
        const activeWAL = this.#meta.activeWAL;
        const chunkNo   = activeWAL.numChunks - 1;
        if (chunkNo >= 0) {
            try {
                const str = world.getDynamicProperty(this.#propWAL(activeWAL.side, chunkNo), "string");
                return new WALChunk(str);
            }
            catch (e) {
                console.error(
                    `Database ${this.#dbName} has a corrupted WAL chunk #${chunkNo}. ` +
                    `We may have a trouble recovering from crashes occuring in the near future.`);
                return undefined;
            }
        }
        else {
            // There are no WAL chunks.
            return undefined;
        }
    }

    /// Return `true` iff it succeeds.
    #tryOverwriteLastWALChunk(chunk: WALChunk): boolean {
        const activeWAL = this.#meta.activeWAL;

        const chunkNo = activeWAL.numChunks - 1;
        if (chunkNo < 0)
            throw new Error(`Internal error: database ${this.#dbName} has no WAL chunks`);

        const chunkStr = chunk.serialise();
        if (chunkStr.length > MAX_STRING_PROPERTY_LENGTH)
            return false; // It doesn't fit.

        world.setDynamicProperty(this.#propWAL(activeWAL.side, chunkNo), chunkStr);
        return true;
    }

    #appendWALChunk(chunk: WALChunk): void {
        const chunkStr = chunk.serialise();
        if (chunkStr.length > MAX_STRING_PROPERTY_LENGTH) {
            console.warn(
                // So there will be a stacktrace for this incident.
                new Error(
                    `This transaction is too large and we cannot write it in a write-ahead log. ` +
                    `Although this isn't the end of the world, some data loss may occur in case ` +
                    `the game crashes in the near future. Keep transactions smaller if at all ` +
                    `possible.`));
            return;
        }

        const activeWAL = this.#meta.activeWAL;
        world.setDynamicProperty(
            this.#propWAL(activeWAL.side, activeWAL.numChunks), chunkStr);

        activeWAL.numChunks++;
        this.#saveMeta();
    }

    #writeWAL(txn: Transaction): void {
        // Writing WAL has to be an atomic operation, otherwise we may
        // corrupt data. No async/await is acceptable until this function
        // returns.
        const entry = new WALEntry(txn.updatedRows);

        // Try appending it in the last WAL chunk. If it fits we overwrite
        // the chunk.
        const chunk = this.#readLastWALChunk();
        if (chunk) {
            chunk.append(entry);
            if (this.#tryOverwriteLastWALChunk(chunk))
                // Yay it fitted!
                return;
        }

        // We had no WAL chunks, or it didn't fit.
        this.#appendWALChunk(new WALChunk().append(entry));
    }

    /// @internal
    public async save(): Promise<void> {
        // We are about to write a snapshot from the perspective of the
        // newest committed transaction to the inactive side of data
        // parts. Any WAL entries we have accumulated on the active side so
        // far are included in the snapshot we're about to write. But
        // writing a snapshot isn't an atomic operation and more
        // transactions can happen during that. So we first need to
        // redirect further WAL entries to the other side before taking a
        // snapshot.
        this.#meta.switchWAL();
        if (this.#meta.activeWAL.numChunks > 0)
            throw new Error(`Internal inconsistency: previous WAL chunks haven't been cleared`);
        // But we don't have to save the change to the active side of WAL
        // entries here. If the game crashes while taking a snapshot, the
        // next time it's brought up we can see the current active data
        // parts has accumulated WAL entries and we can redo taking the
        // snapshot by replay them, then switch the sides.

        const parts = this.#meta.inactiveParts;
        const tid   = this.#newestCommittedTid;
        const self  = this;
        await writeSnapshot(tid, this.#tables.values())
            .fuse(conduit(function* () {
                const numChunks =
                    yield* sinkDynamicProperty(
                        world,
                        parts.numChunks,
                        i => self.#propPart(parts.side, i));
                self.#meta.switchParts().activeParts.numChunks = numChunks;
            }))
            .runAsync();

        // Now we have taken a snapshot and both of the active parts and
        // WALs now point to the other side. Save changes to the metadata,
        // and then delete obsolete WAL entries afterwards. The game can
        // crash while deleting them, but that's not an issue because we
        // can safely ignore leftovers.
        const oldWALMeta      = this.#meta.inactiveWAL;
        const numOldWALChunks = oldWALMeta.numChunks;
        oldWALMeta.numChunks = 0;
        this.#saveMeta();

        // THINKME: Should we do this asynchronously? We can, but are not
        // sure if we should. The only downside of doing it synchronously
        // is that the watchdog is going to kill us if we have accumulated
        // way too many WAL chunks, which is highly unlikely to happen.
        for (let i = 0; i < numOldWALChunks; i++) {
            world.setDynamicProperty(this.#propWAL(oldWALMeta.side, i), undefined);
        }
    }

    #saveMeta(): void {
        const metaStr = this.#meta.serialise();
        if (metaStr.length > MAX_STRING_PROPERTY_LENGTH) {
            throw new Error(`Metadata too large: got ${metaStr.length} bytes but expected <= ${MAX_STRING_PROPERTY_LENGTH} bytes`);
        }
        else {
            world.setDynamicProperty(this.#propMeta, metaStr);
        }
    }

    public version(num: number): Version {
        if (worldInitialised) {
            throw new Error(
                "Attempted to declare a database version after initialising the world. It's too late");
        }
        else {
            return this.#meta.version(num);
        }
    }

    /** Obtain a table handle that isn't bound to a transaction. Operations
     * performed on the handle will create temporary transactions that are
     * committed immediately after performing a single operation. The type
     * `T` denotes the type of objects stored in the table. Note that `T`
     * must satisfy `Storable` but this constraint cannot be expressed in
     * TypeScript due to
     * https://github.com/microsoft/TypeScript/issues/35164
     */
    public table<T>(id: TableId): TableProxy<T> {
        return new TableProxy<T>(this, id);
    }

    /** Start a transaction and apply a function to it. The transaction
     * will be committed when the function returns, or aborted when it
     * throws. When a write conflict occurs, the transaction will be
     * automatically restarted. This means any side-effects caused by `f`
     * have to be idempotent because they can happen more than once.
     */
    public async transaction<R>(f: (txn: Transaction) => Promise<R>): Promise<R> {
        while (true) {
            const txn = new Transaction(this);
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

    /// Package private: user code should not use this.
    public tableStore<T>(id: TableId): TableStore<T> {
        const table = this.#tables.get(id);
        if (table)
            return table;
        else
            throw new Error(`No table named ${id} has been declared`);
    }
}

world.afterEvents.worldInitialize.subscribe(async () => {
    for (const db of databases.values()) {
        await db.load();
    }
    worldInitialised = true;
});
