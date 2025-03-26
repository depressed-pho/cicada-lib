import { Block, BlockRaycastHit } from "./block.js";
import { Dimension } from "./dimension.js";
import { HasDynamicProperties } from "./dynamic-props.js";
import { EntityBreathable } from "./entity/breathable.js";
import { EntityHealth, EntityLavaMovement, EntityMovement, EntityUnderwaterMovement } from "./entity/attributes.js";
import { EntityEquipment } from "./entity/equipment.js";
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
    EntityEquipment,
    EntityHealth,
    EntityInventory,
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
        return this.raw.isValid;
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

    public get breathable(): EntityBreathable|undefined {
        if (this.#breathable === undefined) {
            const raw = this.raw.getComponent(EntityBreathable.typeId);
            this.#breathable = raw ? new EntityBreathable(raw) : null;
        }
        return this.#breathable ?? undefined;
    }
    #breathable?: EntityBreathable|null;

    public get canClimb(): boolean {
        if (this.#canClimb === undefined) {
            this.#canClimb = !!this.raw.getComponent("minecraft:can_climb");
        }
        return this.#canClimb;
    }
    #canClimb?: boolean;

    public get health(): EntityHealth|undefined {
        if (this.#health === undefined) {
            const raw = this.raw.getComponent(EntityHealth.typeId);
            this.#health = raw ? new EntityHealth(raw) : null;
        }
        return this.#health ?? undefined;
    }
    #health?: EntityHealth|null;

    public get equipment(): EntityEquipment|undefined {
        if (this.#equipment === undefined) {
            const raw = this.raw.getComponent(EntityEquipment.typeId);
            this.#equipment = raw ? new EntityEquipment(raw) : null;
        }
        return this.#equipment ?? undefined;
    }
    #equipment?: EntityEquipment|null;

    public get inventory(): EntityInventory|undefined {
        if (this.#inventory === undefined) {
            const raw = this.raw.getComponent(EntityInventory.typeId);
            this.#inventory = raw ? new EntityInventory(raw) : null;
        }
        return this.#inventory ?? undefined;
    }
    #inventory?: EntityInventory|null;

    public get isHiddenWhenInvisible(): boolean {
        if (this.#isHiddenWhenInvisible === undefined) {
            this.#isHiddenWhenInvisible = !!this.raw.getComponent("minecraft:is_hidden_when_invisible");
        }
        return this.#isHiddenWhenInvisible;
    }
    #isHiddenWhenInvisible?: boolean;

    public get lavaMovement(): EntityLavaMovement|undefined {
        if (this.#lavaMovement === undefined) {
            const raw = this.raw.getComponent(EntityLavaMovement.typeId);
            this.#lavaMovement = raw ? new EntityLavaMovement(raw) : null;
        }
        return this.#lavaMovement ?? undefined;
    }
    #lavaMovement?: EntityLavaMovement|null;

    public get movement(): EntityMovement|undefined {
        if (this.#movement === undefined) {
            const raw = this.raw.getComponent(EntityMovement.typeId);
            this.#movement = raw ? new EntityMovement(raw) : null;
        }
        return this.#movement ?? undefined;
    }
    #movement?: EntityMovement|null;

    public get rideable(): EntityRideable|undefined {
        if (this.#rideable === undefined) {
            const raw = this.raw.getComponent(EntityRideable.typeId);
            this.#rideable = raw ? new EntityRideable(raw) : null;
        }
        return this.#rideable ?? undefined;
    }
    #rideable?: EntityRideable|null;

    public get underwaterMovement(): EntityUnderwaterMovement|undefined {
        if (this.#underwaterMovement === undefined) {
            const raw = this.raw.getComponent(EntityUnderwaterMovement.typeId);
            this.#underwaterMovement = raw ? new EntityUnderwaterMovement(raw) : null;
        };
        return this.#underwaterMovement ?? undefined;
    }
    #underwaterMovement?: EntityUnderwaterMovement|null;
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
