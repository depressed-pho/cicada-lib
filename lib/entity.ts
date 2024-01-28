import { Block, BlockRaycastHit } from "./block.js";
import { Dimension } from "./dimension.js";
import { HasDynamicProperties } from "./dynamic-props.js";
import { EntityBreathable } from "./entity/breathable.js";
import { EntityHealth, EntityLavaMovement, EntityMovement, EntityUnderwaterMovement } from "./entity/attributes.js";
import { EntityEquipment } from "./entity/equipment.js";
import { EntityCanClimb, EntityIsHiddenWhenInvisible } from "./entity/flags.js";
import { EntityInventory } from "./entity/inventory.js";
import { EntityRideable } from "./entity/rideable.js";
import { EntityTags } from "./entity/tags.js";
import { lazy } from "./lazy.js";
import { Location } from "./location.js";
import { Wrapper } from "./wrapper.js";
import { BlockRaycastOptions, EntityDamageSource, EntityQueryOptions,
         Vector2, Vector3 } from "@minecraft/server";
import * as MC from "@minecraft/server";

export { BlockRaycastOptions, EntityDamageSource, EntityQueryOptions };
export {
    EntityBreathable,
    EntityCanClimb,
    EntityEquipment,
    EntityHealth,
    EntityInventory,
    EntityIsHiddenWhenInvisible,
    EntityLavaMovement,
    EntityMovement,
    EntityRideable,
    EntityTags,
    EntityUnderwaterMovement,
};
export { EquipmentSlot } from "./entity/equipment.js";

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

    public get isValid(): boolean {
        return this.raw.isValid();
    }

    public get location(): Location {
        return new Location(this.raw.location);
    }

    public get typeId(): string {
        return this.raw.typeId;
    }

    /** The set of tags for this entity. The set isn't a snapshot. You can
     * add or remove tags through the standard Set API.
     */
    public readonly tags: Set<string>
        = lazy(() => new EntityTags(this.raw));

    public getBlockFromViewDirection(options?: BlockRaycastOptions): BlockRaycastHit | undefined {
        let rawHit = this.raw.getBlockFromViewDirection(options);
        return rawHit
            ? {
                block:        new Block(rawHit.block),
                face:         rawHit.face,
                faceLocation: rawHit.faceLocation
              }
            : undefined;
    }

    public kill(): void {
        this.raw.kill();
    }

    public matches(options: EntityQueryOptions): boolean {
        return this.raw.matches(options);
    }

    public teleport(location: Vector3, opts?: TeleportOptions): void {
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
    }

    public triggerEvent(eventName: string): void {
        this.raw.triggerEvent(eventName);
    }

    // --------- Components ---------

    public readonly breathable: EntityBreathable|undefined
        = lazy(() => {
            const raw = this.raw.getComponent(EntityBreathable.typeId);
            return raw ? new EntityBreathable(raw) : undefined;
        });

    public readonly canClimb: EntityCanClimb|undefined
        = lazy(() => {
            const raw = this.raw.getComponent(EntityCanClimb.typeId);
            return raw ? new EntityCanClimb(raw) : undefined;
        });

    public readonly health: EntityHealth|undefined
        = lazy(() => {
            const raw = this.raw.getComponent(EntityHealth.typeId);
            return raw ? new EntityHealth(raw) : undefined;
        });

    public readonly equipment: EntityEquipment|undefined
        = lazy(() => {
            const raw = this.raw.getComponent(EntityEquipment.typeId);
            return raw ? new EntityEquipment(raw) : undefined;
        });

    public readonly inventory: EntityInventory|undefined
        = lazy(() => {
            const raw = this.raw.getComponent(EntityInventory.typeId);
            return raw ? new EntityInventory(raw) : undefined;
        });

    public readonly isHiddenWhenInvisible: EntityIsHiddenWhenInvisible|undefined
        = lazy(() => {
            const raw = this.raw.getComponent(EntityIsHiddenWhenInvisible.typeId);
            return raw ? new EntityIsHiddenWhenInvisible(raw) : undefined;
        });

    public readonly lavaMovement: EntityLavaMovement|undefined
        = lazy(() => {
            const raw = this.raw.getComponent(EntityLavaMovement.typeId);
            return raw ? new EntityLavaMovement(raw) : undefined;
        });

    public readonly movement: EntityMovement|undefined
        = lazy(() => {
            const raw = this.raw.getComponent(EntityMovement.typeId);
            return raw ? new EntityMovement(raw) : undefined;
        });

    public readonly rideable: EntityRideable|undefined
        = lazy(() => {
            const raw = this.raw.getComponent(EntityRideable.typeId);
            return raw ? new EntityRideable(raw) : undefined;
        });

    public readonly underwaterMovement: EntityUnderwaterMovement|undefined
        = lazy(() => {
            const raw = this.raw.getComponent(EntityUnderwaterMovement.typeId);
            return raw ? new EntityUnderwaterMovement(raw) : undefined;
        });
}

export interface TeleportOptions {
    checkForBlocks?: boolean;
    dimension?:      Dimension;
    facingLocation?: Vector3;
    keepVelocity?:   boolean;
    rotation?:       Vector2;
}

export interface EntityDieAfterEvent {
    readonly damageSource: EntityDamageSource;
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
