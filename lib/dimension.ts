import { Block } from "./block.js";
import { Entity } from "./entity.js";
import { map } from "./iterable.js";
import * as MC from "@minecraft/server";

export class Dimension {
    readonly #dimension: MC.Dimension;

    /** The constructor is public only because of a language
     * limitation. User code must never call it directly. */
    public constructor(rawDimension: MC.Dimension) {
        this.#dimension = rawDimension;
    }

    public get id(): string {
        return this.#dimension.id;
    }

    public getBlock(location: MC.Vector3): Block|undefined {
        const raw = this.#dimension.getBlock(location);
        return raw ? new Block(raw) : undefined;
    }

    public getEntities(opts?: MC.EntityQueryOptions): IterableIterator<Entity> {
        return map(this.#dimension.getEntities(opts), raw => {
            return new Entity(raw);
        });
    }

    public spawnEntity(identifier: string, location: MC.Vector3): Entity {
        return new Entity(this.#dimension.spawnEntity(identifier, location));
    }
}
