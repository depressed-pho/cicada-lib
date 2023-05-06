import { Block } from "./block.js";
import { Entity } from "./entity.js";
import { Wrapper } from "./wrapper.js";
import { map } from "./iterable.js";
import * as MC from "@minecraft/server";

export class Dimension extends Wrapper<MC.Dimension> {
    public get id(): string {
        return this.raw.id;
    }

    public getBlock(location: MC.Vector3): Block|undefined {
        const raw = this.raw.getBlock(location);
        return raw ? new Block(raw) : undefined;
    }

    public getEntities(opts?: MC.EntityQueryOptions): IterableIterator<Entity> {
        return map(this.raw.getEntities(opts), raw => {
            return new Entity(raw);
        });
    }

    public spawnEntity(identifier: string, location: MC.Vector3): Entity {
        return new Entity(this.raw.spawnEntity(identifier, location));
    }
}
