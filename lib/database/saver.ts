import { type Database } from "../database.js";
import { Thread } from "../thread.js";
import { Notify } from "../sync/notify.js";

/// @internal
export class DatabaseSaver extends Thread {
    readonly #db: Database;
    readonly #saveRequested: Notify;

    public constructor(db: Database) {
        super("DatabaseSaver");
        this.#db            = db;
        this.#saveRequested = new Notify();
    }

    public schedule() {
        this.#saveRequested.notifyOne();
    }

    protected async *run() {
        while (true) {
            // When we get save requests, we always save a snapshot from
            // the perspective of the known newest committed
            // transaction. This is because getting snapshots doesn't place
            // read-locks on rows that haven't been explicitly read by the
            // transaction, and active transactions older than that may
            // update such rows. Also we squash multiple requests into one
            // to save time.
            await this.#saveRequested.notified();
            await this.#db.save();
        }
    }
}
