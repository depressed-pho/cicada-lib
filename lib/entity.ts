import { Block } from "./block.js";
import { Dimension } from "./dimension.js";
import { EntityTags } from "./entity/tags.js";
import { ItemStack } from "./item/stack.js";
import { Location } from "./location.js";
import { BlockRaycastOptions, EntityDamageCause, Vector2, Vector3 } from "@minecraft/server";
import * as MC from "@minecraft/server";

export { BlockRaycastOptions, EntityDamageCause };

export class Entity {
    readonly #entity: MC.Entity;

    /** The constructor is public only because of a language
     * limitation. User code must never call it directly. */
    public constructor(rawEntity: MC.Entity) {
        this.#entity = rawEntity;
    }

    /** Package private: user code should not use this. */
    public get raw(): MC.Entity {
        return this.#entity;
    }

    public get dimension(): Dimension {
        return new Dimension(this.#entity.dimension);
    }

    public get id(): string {
        return this.#entity.id;
    }

    public get isSneaking(): boolean {
        return this.#entity.isSneaking;
    }

    public get location(): Location {
        return new Location(this.#entity.location);
    }

    public get typeId(): string {
        return this.#entity.typeId;
    }

    /** Returns the set of tags for this entity. The set isn't a
     * snapshot. You can add or remove tags through the standard Set
     * API. */
    public get tags(): Set<string> {
        return new EntityTags(this.#entity);
    }

    public kill(): void {
        this.#entity.kill();
    }

    public getBlockFromViewDirection(options?: BlockRaycastOptions): Block {
        return new Block(this.#entity.getBlockFromViewDirection(options));
    }

    public getDynamicProperty(identifier: string): boolean|number|string|undefined;
    public getDynamicProperty(identifier: string, ty: "boolean?"): boolean|undefined;
    public getDynamicProperty(identifier: string, ty: "number?" ): number |undefined;
    public getDynamicProperty(identifier: string, ty: "string?" ): string |undefined;
    public getDynamicProperty(identifier: string, ty: "boolean" ): boolean;
    public getDynamicProperty(identifier: string, ty: "number"  ): number;
    public getDynamicProperty(identifier: string, ty: "string"  ): string |undefined;
    public getDynamicProperty(identifier: string, ty?: string): boolean|number|string|undefined {
        const prop = this.#entity.getDynamicProperty(identifier);

        if (ty == null) {
            // No constraints are requested on the type of the property.
            return prop;
        }
        else {
            const expectedType = ty.substring(0, ty.length - 1);
            const actualType   = typeof prop;

            if (prop === undefined) {
                if (ty.endsWith("?")) {
                    // It can also be undefined.
                    return prop;
                }
                else {
                    throw new TypeError(`Dynamic property \`${identifier}' of the entity is expected to be a ${expectedType} but is actually undefined`);
                }
            }
            else if (expectedType === actualType) {
                return prop;
            }
            else {
                throw new TypeError(`Dynamic property \`${identifier} of the entity is expected to be a ${expectedType} but is actually a ${actualType}`);
            }
        }
    }

    public setDynamicProperty(identifier: string, value: boolean|number|string): void {
        this.#entity.setDynamicProperty(identifier, value);
    }

    public removeDynamicProperty(identifier: string): void {
        this.#entity.removeDynamicProperty(identifier);
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
            this.#entity.teleportFacing(
                location,
                opts.dimension?.raw || this.#entity.dimension,
                opts.facingLocation,
                opts.keepVelocity);
        }
        else {
            this.#entity.teleport(
                location,
                opts?.dimension?.raw || this.#entity.dimension,
                opts?.rotation?.x    || this.#entity.getRotation().x,
                opts?.rotation?.y    || this.#entity.getRotation().y,
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
        this.#entity.teleport(location, rawOpts);
        */
    }

    public triggerEvent(eventName: string): void {
        this.#entity.triggerEvent(eventName);
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
