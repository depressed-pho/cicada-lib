import "../shims/text-encoder.js";
import * as A85 from "../ascii85.js";
import { Buffer } from "../buffer.js";
import { type Conduit, awaitForever, conduit, decodeUtf8, dropE, headE, peekE,
         peekForeverE, takeE, yieldC, yieldMany } from "../conduit.js";
import { readUint8, readUint32, takeOctets } from "../conduit/binary.js";
import { lazy } from "../lazy.js";
import * as LZ4 from "../lz4.js";
import { type Indices } from "./schema.js";
import { TableStore } from "./table.js";
import * as PB from "./table_pb.js";
import { type TxnId } from "./transaction.js";

/** We store a database snapshot in the following format, and encode it in
 * Ascii85:
 *
 * +----------+---------+----------+
 * | Magic    | Version | Payload  |
 * | 4 octets | 1 octet | n octets |
 * +==========+=========+==========+
 * | 'SNAP'   |  0x01   |   ...    |
 * +----------+---------+----------+
 *
 * The payload is a concatenation of zero or more LZ4 frames representing a
 * sequence of table snapshots in the following format:
 *
 * +------------+-----------------+--------------+----------+
 * | Table mark | Table ID length |   Table ID   |   Rows   |
 * |  1 octet   |    n octets     |   n octets   | n octets |
 * +============+=================+==============+==========+
 * |    0x01    |     uint32      | UTF-8 string |   ...    |
 * +------------+-----------------+--------------+----------+
 *
 * And a row is represented as follows:
 *
 * +----------+------------+-------------+
 * | Row mark | Row length | Row content |
 * | 1 octet  |  n octets  |  n octets   |
 * +==========+============+=============+
 * |   0x02   |   uint32   |     ...     |
 * +----------+------------+-------------+
 *
 * A row content is a binary representation of a Protobuf message "Row"
 * defined in "table.proto". Don't worry about data corruption going
 * unnoticed. LZ4 frames can have content checksums.
 *
 * The "uint32" type is the same as uint32 in the Protobuf wire
 * format. It's a MSB-flagged little-endian unsigned integer.
 *
 * The whole point of this structure is that the number of tables or the
 * number of rows are represented implicitly, which allows us to serialise
 * a snapshot in a streamed manner.
 *
 * We could take an easier route and just serialise it in a protobuf
 * message like this:
 *
 * message Snapshot {
 *   repeated Table tables = 1;
 * }
 * message Table {
 *   string id = 1;
 *   repeated Row rows = 2;
 * }
 *
 * But this means we would have to serialise or deserialise the entire
 * database all at once, which is impossible for large data sets.
 *
 * @internal
 */

/// @internal
export function writeSnapshot(tid: TxnId, tables: Iterable<TableStore<any>>): Conduit<unknown, string, void> {
    return conduit(function* () {
        yield* writeHeader;
        yield* yieldMany(tables)
            .fuse(awaitForever(table => writeTable(tid, table)))
            .fuse(LZ4.compressC());
    }).fuse(A85.encodeC);
}

const writeHeader: Conduit<unknown, Buffer, void> =
    lazy(() =>
        conduit(function* () {
            const buf = new Buffer();
            buf.appendUint32(0x534E4150); // 'SNAP'
            buf.appendUint8 (0x01);       // Version
            yield* yieldC(buf);
        }));

function writeTable(tid: TxnId, table: TableStore<any>): Conduit<unknown, Buffer, void> {
    const enc = new TextEncoder();
    return conduit(function* () {
        const buf = new BufferExt();
        buf.appendUint8(0x01); // Table mark

        const u8TableId = enc.encode(table.id);
        buf.appendVarUint(u8TableId.byteLength, true);
        buf.append(u8TableId);
        yield* yieldC(buf);

        for (const row of table.snapshot(tid)) {
            const buf = new BufferExt();
            buf.appendUint8(0x02); // Row mark

            const bin = PB.Row.toBinary(row);
            buf.appendVarUint(bin.byteLength, true);
            buf.append(bin);
            yield* yieldC(buf);
        }
    });
}

/// @internal
export function readSnapshot(schema: Map<string, Indices>): Conduit<string, TableStore<any>, void> {
    return A85.decodeC.fuse(
        conduit(function* () {
            yield* readHeader;
            yield* LZ4.decompressC()
                .fuse(peekForeverE(readTable(schema)));
        }));
}

const readHeader: Conduit<Buffer, unknown, void> =
    lazy(() =>
        conduit(function* () {
            const magic = yield* readUint32();
            if (magic != 0x534E4150) // 'SNAP'
                throw new Error(`Bad magic for a snapshot: ${magic}`);

            const version = yield* readUint8;
            if (version != 0x01)
                throw new Error(`Unknown snapshot version: ${version}`);
        }));

function readTable(schema: Map<string, Indices>): Conduit<Buffer, TableStore<any>, void> {
    return conduit(function* () {
        const mark = yield* readUint8;
        if (mark != 0x01) // table
            throw new Error(`Expected a table mark (0x01) but got something else: ${mark}`);

        const idLen   = yield* readVarUint(true);
        const tableId = yield* takeE(idLen).fuse(decodeUtf8);
        const indices = schema.get(tableId);
        if (!indices)
            throw new Error(`Unknown table ID: ${tableId}`);

        const table = new TableStore(tableId, indices);
        while (true) {
            const row = yield* readRow;
            if (row)
                table.unsafeAddRow(row);
            else
                break;
        }
        yield* yieldC(table);
    });
}

const readRow: Conduit<Buffer, unknown, PB.Row|undefined> =
    lazy(() =>
        conduit(function* () {
            const mark = yield* peekE;
            if (mark != 0x02) // row
                return;

            yield* dropE(1); // Discard the row mark
            const rowLen = yield* readVarUint(true);
            const rowBin = yield* takeOctets(rowLen);
            if (rowBin.byteLength < rowLen)
                throw new Error(`Expected ${rowLen} octets but only got ${rowBin.byteLength} for a row`);

            return PB.Row.fromBinary(rowBin);
        }));

function readVarUint(littleEndian = false): Conduit<Buffer, any, number> {
    return conduit(function* () {
        if (!littleEndian)
            throw new Error("Big-endian varints are currently not supported (or probably never be)");

        let n = 0;
        for (let shift = 0;; shift += 7) {
            const o = yield* headE;
            n |= (o & 0x7F) << shift;
            if ((o & 0x80) == 0) {
                if (n > 0xFFFFFFFF)
                    throw new RangeError(`Expected a 32-bits unsigned integer but got: ${n}`);
                return n >>> 0;
            }
        }
    });
}

class BufferExt extends Buffer {
    public appendVarUint(n: number, littleEndian = false): this {
        if (!littleEndian)
            throw new Error("Big-endian varints are currently not supported (or probably never be)");
        if (n < 0)
            throw new RangeError(`Number has to be non-negative: ${n}`);

        while (n > 0x7F) {
            this.appendUint8((n & 0x7F) | 0x80);
            n >>>= 7;
        }
        this.appendUint8(n);

        return this;
    }
}
