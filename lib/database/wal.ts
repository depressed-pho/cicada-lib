import { OrdMap } from "../collections/ordered-map.js";
import { type TableId } from "./table.js";
import { type Key, writeKey } from "./key.js";
import { type Storable, writeStorable } from "./storable.js";
import * as PB from "./wal_pb.js";
import * as CicASCII from "../cic-ascii.js";

/// @internal
export const DeletionMark = Symbol("DELETED");
export type DeletionMark = typeof DeletionMark;

/// @internal
export class WALChunk {
    readonly #entries: PB.WALEntry[];

    public constructor();
    public constructor(wal: string);
    public constructor(arg?: string) {
        if (arg == null) {
            this.#entries = [];
        }
        else {
            const bin   = CicASCII.decode(arg);
            const chunk = PB.WALChunk.fromBinary(bin);

            this.#entries = chunk.entries;
        }
    }

    public append(entry: WALEntry): this {
        this.#entries.push(entry.write());
        return this;
    }

    public write(): PB.WALChunk {
        return {
            entries: this.#entries
        };
    }

    public serialise(): string {
        const bin = PB.WALChunk.toBinary(this.write());
        return CicASCII.encode(bin);
    }
}

/// @internal
export class WALEntry {
    readonly #tables: OrdMap<TableId, OrdMap<Key, Storable|DeletionMark>>;

    static #writeRows(rows: OrdMap<Key, Storable|DeletionMark>): PB.WALEntry_Rows {
        const ret: PB.WALEntry_Rows = {
            rows: []
        };
        for (const [pKey, obj] of rows) {
            const row: PB.WALEntry_Rows_Row = {
                key: writeKey(pKey)
            };
            if (obj !== DeletionMark)
                row.value = writeStorable(obj);
            ret.rows.push(row);
        }
        return ret;
    }

    public constructor(updatedRows: OrdMap<TableId, OrdMap<Key, Storable|DeletionMark>>) {
        this.#tables = updatedRows;
    }

    public write(): PB.WALEntry {
        const ret: PB.WALEntry = {
            tables: {}
        };
        for (const [tableId, rows] of this.#tables) {
            ret.tables[tableId] = WALEntry.#writeRows(rows);
        }
        return ret;
    }
}
