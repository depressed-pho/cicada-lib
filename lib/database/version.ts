import { IDatabaseSchema, Indices } from "./schema.js";
import * as PB from "./metadata_pb.js";

export class Version {
    readonly #num: number;
    readonly #schema: Map<string, Indices>;

    /// Package private: user code should not use this.
    public constructor(num: number);
    public constructor(obj: PB.Version);
    public constructor(arg: any) {
        if (typeof arg === "number") {
            this.#num    = arg;
            this.#schema = new Map();
        }
        else {
            this.#num    = arg.num;
            this.#schema = Version.readSchema(arg.schema);
        }
    }

    private static readSchema(obj: Record<string, PB.Indices>): Map<string, Indices> {
        return new Map<string, Indices>(
            Object.entries(obj).map(([table, indices]) => {
                return [table, new Indices(indices)];
            }));
    }

    private static writeSchema(schema: Map<string, Indices>): Record<string, PB.Indices> {
        const ret: Record<string, PB.Indices> = {};
        for (const [table, indices] of schema) {
            ret[table] = indices.toMessage();
        }
        return ret;
    }

    /// @internal
    public get num(): number {
        return this.#num;
    }

    /// @internal
    public get schema(): Map<string, Indices> {
        return this.#schema;
    }

    /// @internal
    public toMessage(): PB.Version {
        return {
            num:    this.#num,
            schema: Version.writeSchema(this.#schema)
        };
    }

    public stores(schema: IDatabaseSchema): this {
        if (this.#schema.size > 0) {
            throw new Error(`Table schema already set for database version ${this.#num}`);
        }
        else {
            for (const [table, indices] of Object.entries(schema)) {
                this.#schema.set(table, new Indices(indices));
            }
        }
        return this;
    }
}
