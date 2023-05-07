import { OrdMap } from "../collections/ordered-map.js";
import { Version } from "./version.js";
import { Side } from "./metadata_pb.js";
import * as PB from "./metadata_pb.js";
import * as CicASCII from "../cic-ascii.js";

export { Side };

/// @internal
export class Metadata {
    readonly versions: OrdMap<number, Version>;
    #activePartsSide: Side;
    readonly #parts: [PartsMeta, PartsMeta];
    #activeWALSide: Side;
    readonly #wals: [WALMeta, WALMeta];

    public constructor();
    public constructor(meta: string);
    public constructor(arg?: string) {
        if (arg == null) {
            this.versions         = new OrdMap();
            this.#activePartsSide = Side.A;
            this.#parts           = [new PartsMeta(Side.A), new PartsMeta(Side.B)];
            this.#activeWALSide   = Side.A;
            this.#wals            = [new WALMeta(Side.A), new WALMeta(Side.B)];
        }
        else {
            const bin  = CicASCII.decode(arg);
            const meta = PB.Metadata.fromBinary(bin);

            this.versions         = Metadata.#readVersions(meta.versions);
            this.#activePartsSide = meta.activeParts;
            this.#parts           = [new PartsMeta(Side.A, meta.partsA!), new PartsMeta(Side.B, meta.partsB!)];
            this.#activeWALSide   = meta.activeWAL;
            this.#wals            = [new WALMeta(Side.A, meta.walA!), new WALMeta(Side.B, meta.walB!)];
        }
    }

    // --- parts ---

    public get activeParts(): PartsMeta {
        return this.#parts[this.#activePartsSide];
    }

    public get inactiveParts(): PartsMeta {
        switch (this.#activePartsSide) {
            case Side.A: return this.#parts[Side.B];
            case Side.B: return this.#parts[Side.A];
        }
    }

    public parts(side: Side): PartsMeta {
        return this.#parts[side];
    }

    public switchParts(): this {
        this.#activePartsSide = this.inactiveParts.side;
        return this;
    }

    // --- wal ---

    public get activeWAL(): WALMeta {
        return this.#wals[this.#activeWALSide];
    }

    public get inactiveWAL(): WALMeta {
        switch (this.#activeWALSide) {
            case Side.A: return this.#wals[Side.B];
            case Side.B: return this.#wals[Side.A];
        }
    }

    public wal(side: Side): WALMeta {
        return this.#wals[side];
    }

    public switchWAL(): this {
        this.#activeWALSide = this.inactiveWAL.side;
        return this;
    }

    static #readVersions(objs: PB.Version[]): OrdMap<number, Version> {
        return new OrdMap<number, Version>(
            objs.map(obj => {
                const ver = new Version(obj);
                return [ver.num, ver] as [number, Version];
            }));
    }

    static #writeVersions(vers: OrdMap<number, Version>): PB.Version[] {
        return Array.from(vers.values()).map(ver => {
            return ver.toMessage();
        });
    }

    public serialise(): string {
        const meta: PB.Metadata = {
            versions:    Metadata.#writeVersions(this.versions),
            activeParts: this.#activePartsSide,
            partsA:      this.#parts[PB.Side.A],
            partsB:      this.#parts[PB.Side.B],
            activeWAL:   this.#activeWALSide,
            walA:        this.#wals[PB.Side.A].write(),
            walB:        this.#wals[PB.Side.B].write()
        };
        const bin = PB.Metadata.toBinary(meta);
        return CicASCII.encode(bin);
    }

    public version(num: number): Version {
        if (this.versions.has(num)) {
            throw new Error(`Version ${num} has already been declared`);
        }
        else {
            const ver = new Version(num);
            this.versions.set(num, ver);
            return ver;
        }
    }
}

export class SideMeta {
    readonly #side: Side;

    public constructor(side: Side) {
        this.#side = side;
    }

    public get side(): Side {
        return this.#side;
    }
}

export class PartsMeta extends SideMeta {
    readonly #meta: PB.PartsMeta;

    public constructor(side: Side, meta?: PB.PartsMeta) {
        super(side);
        this.#meta = meta ?? PB.PartsMeta.create();
    }

    public get version(): number {
        return this.#meta.version;
    }

    public set version(num: number) {
        this.#meta.version = num;
    }

    public get numChunks(): number {
        return this.#meta.numChunks;
    }

    public set numChunks(num: number) {
        this.#meta.numChunks = num;
    }

    public write(): PB.PartsMeta {
        return this.#meta;
    }
}

export class WALMeta extends SideMeta {
    readonly #meta: PB.WALMeta;

    public constructor(side: Side, meta?: PB.WALMeta) {
        super(side);
        this.#meta = meta ?? PB.WALMeta.create();
    }

    public get numChunks(): number {
        return this.#meta.numChunks;
    }

    public set numChunks(num: number) {
        this.#meta.numChunks = num;
    }

    public write(): PB.WALMeta {
        return this.#meta;
    }
}
