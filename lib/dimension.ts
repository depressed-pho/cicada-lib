import { Entity, EntityQueryOptions, entityQueryOptionsToRaw } from "./entity.js";
import { Location, BlockLocation } from "./location.js";
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

    public getEntities(opts?: EntityQueryOptions): Iterable<Entity> {
        return map(this.#dimension.getEntities(entityQueryOptionsToRaw(opts)), raw => {
            return new Entity(raw);
        });
    }

    public spawnEntity(identifier: string, location: Location|BlockLocation): Entity {
        return new Entity(this.#dimension.spawnEntity(identifier, location.raw));
    }
}
