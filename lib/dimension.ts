import { Block } from "./block.js";
import { Entity } from "./entity.js";
import { ItemStack } from "./item/stack.js";
import { Wrapper } from "./wrapper.js";
import { map } from "./iterable.js";
import { Vector3 } from "@minecraft/server";
import * as MC from "@minecraft/server";

export class Dimension extends Wrapper<MC.Dimension> {
    public get id(): string {
        return this.raw.id;
    }

    /** Get the block at the given location. This function never throws. */
    public getBlock(location: MC.Vector3): Block|undefined {
        try {
            const raw = this.raw.getBlock(location);
            return raw ? new Block(raw) : undefined;
        }
        catch (e) {
            if (e instanceof MC.LocationInUnloadedChunkError ||
                e instanceof MC.LocationOutOfWorldBoundariesError)
                return undefined;
            else
                throw e;
        }
    }

    public getEntities(opts?: MC.EntityQueryOptions): IterableIterator<Entity> {
        return map(this.raw.getEntities(opts), raw => {
            return new Entity(raw);
        });
    }

    public spawnEntity(identifier: string, location: Vector3): Entity {
        return new Entity(this.raw.spawnEntity(identifier, location));
    }

    public spawnItem(itemStack: ItemStack, location: Vector3): Entity {
        return new Entity(this.raw.spawnItem(itemStack.raw, location));
    }
}
