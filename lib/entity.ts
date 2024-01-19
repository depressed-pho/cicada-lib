import { Block, BlockRaycastHit } from "./block.js";
import { Dimension } from "./dimension.js";
import { HasDynamicProperties } from "./dynamic-props.js";
import { EntityTags } from "./entity/tags.js";
import { Location } from "./location.js";
import { Wrapper } from "./wrapper.js";
import { BlockRaycastOptions, EntityDamageSource, EntityQueryOptions,
         Vector2, Vector3 } from "@minecraft/server";
import * as MC from "@minecraft/server";

export { BlockRaycastOptions, EntityDamageSource, EntityQueryOptions };

export class Entity extends HasDynamicProperties(Wrapper<MC.Entity>) {
    #tags?: EntityTags;

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

    /** Returns the set of tags for this entity. The set isn't a
     * snapshot. You can add or remove tags through the standard Set
     * API. */
    public get tags(): Set<string> {
        if (!this.#tags)
            this.#tags = new EntityTags(this.raw);

        return this.#tags;
    }

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
