import { Dimension } from "./dimension.js";
import { EntityTags } from "./entity/tags.js";
import { ItemStack } from "./item-stack.js";
import { Location } from "./location.js";
import * as MC from "@minecraft/server";

export class Entity {
    readonly #entity: MC.Entity;

    /** The constructor is public only because of a language
     * limitation. User code must never call it directly. */
    public constructor(rawEntity: MC.Entity) {
        this.#entity = rawEntity;
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

    public triggerEvent(eventName: string): void {
        this.#entity.triggerEvent(eventName);
    }
}

export interface EntityQueryOptions {
    closest?: number;
    excludeFamilies?: string[];
    excludeGameModes?: MC.GameMode[];
    excludeNames?: string[];
    excludeTags?: string[];
    excludeTypes?: string[];
    families?: string[];
    farthest?: number;
    gameMode?: MC.GameMode;
    location?: Location;
    maxDistance?: number;
    maxHorizontalRotation?: number;
    maxLevel?: number;
    maxVerticalRotation?: number;
    minDistance?: number;
    minHorizontalRotation?: number;
    minLevel?: number;
    minVerticalRotation?: number;
    name?: string;
    scoreOptions?: MC.EntityQueryScoreOptions[];
    tags?: string[];
    type?: string;
    volume?: MC.BlockAreaSize;
}

/** Package private: user code should not use this. */
export function entityQueryOptionsToRaw<T extends EntityQueryOptions|undefined>(opts: T): T extends EntityQueryOptions ? MC.EntityQueryOptions : undefined {
    if (opts) {
        // @ts-ignore
        return {
            ...opts,
            ...(opts.location ? {location: opts.location.raw} : {})
        };
    }
    else {
        // @ts-ignore
        return;
    }
}

export interface ItemUseEvent {
    readonly item: ItemStack;
    readonly source: Entity;
}
