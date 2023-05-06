import { Block } from "./block.js";
import { Dimension } from "./dimension.js";
import { HasDynamicProperties } from "./dynamic-props.js";
import { EntityTags } from "./entity/tags.js";
import { ItemStack } from "./item/stack.js";
import { Location } from "./location.js";
import { Wrapper } from "./wrapper.js";
import { BlockRaycastOptions, EntityDamageCause, Vector2, Vector3 } from "@minecraft/server";
import * as MC from "@minecraft/server";

export { BlockRaycastOptions, EntityDamageCause };

export class Entity extends HasDynamicProperties(Wrapper<MC.Entity>) {
    public get dimension(): Dimension {
        return new Dimension(this.raw.dimension);
    }

    public get id(): string {
        return this.raw.id;
    }

    public get isSneaking(): boolean {
        return this.raw.isSneaking;
    }

    public get location(): Location {
        return new Location(this.raw.location);
    }

    public get typeId(): string {
        return this.raw.typeId;
    }

    /** Returns the set of tags for this entity. The set isn't a
     * snapshot. You can add or remove tags through the standard Set
     * API. */
    public get tags(): Set<string> {
        return new EntityTags(this.raw);
    }

    public kill(): void {
        this.raw.kill();
    }

    public getBlockFromViewDirection(options?: BlockRaycastOptions): Block {
        return new Block(this.raw.getBlockFromViewDirection(options));
    }

    public teleport(location: Vector3, opts?: TeleportOptions): void {
        // FIXME: Remove this shim code when @minecraft/server is updated.
        if (opts && opts.checkForBlocks) {
            throw new Error("TeleportOptions.checkForBlocks is not supported by this API");
        }
        if (opts && opts.facingLocation) {
            if (opts.rotation) {
                throw new Error("TeleportOptions.facingLocation and .rotation cannot be used at the same time with this API");
            }
            this.raw.teleportFacing(
                location,
                opts.dimension?.raw || this.raw.dimension,
                opts.facingLocation,
                opts.keepVelocity);
        }
        else {
            this.raw.teleport(
                location,
                opts?.dimension?.raw || this.raw.dimension,
                opts?.rotation?.x    || this.raw.getRotation().x,
                opts?.rotation?.y    || this.raw.getRotation().y,
                opts?.keepVelocity);
        }
        /*
        // New API
        let rawOpts: MC.TeleportOptions = {};
        if (opts) {
            if (opts.checkForBlocks) {
                rawOpts.checkForBlocks = opts.checkForBlocks;
            }
            if (opts.dimension) {
                rawOpts.dimension = opts.dimension.raw;
            }
            if (opts.facingLocation) {
                rawOpts.facingLocation = opts.facingLocation;
            }
            if (opts.keepVelocity) {
                rawOpts.keepVelocity = opts.keepVelocity;
            }
            if (opts.rotation) {
                rawOpts.rotation = opts.rotation;
            }
        }
        this.raw.teleport(location, rawOpts);
        */
    }

    public triggerEvent(eventName: string): void {
        this.raw.triggerEvent(eventName);
    }
}

export interface TeleportOptions {
    checkForBlocks?: boolean;
    dimension?:      Dimension;
    facingLocation?: Vector3;
    keepVelocity?:   boolean;
    rotation?:       Vector2;
}

export interface EntityDieEvent {
    readonly damageCause: EntityDamageCause;
    readonly deadEntity: Entity;
}

export interface EntityEventOptions {
    entities?: Entity[];
    entityTypes?: string[];
}

/** Package private: user code should not use this. */
export function entityEventOptionsToRaw(opts: EntityEventOptions): MC.EntityEventOptions {
    let ret: MC.EntityEventOptions = {};
    if (opts.entities) {
        ret.entities = opts.entities.map(e => e.raw);
    }
    if (opts.entityTypes) {
        ret.entityTypes = opts.entityTypes;
    }
    return ret;
}

export interface ItemUseEvent {
    readonly itemStack: ItemStack;
    readonly source: Entity;
}
