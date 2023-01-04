import { ItemStack } from "./item-stack.js";
import * as MC from "@minecraft/server";

export class Entity {
    readonly #entity: MC.Entity;

    /** The constructor is public only because of a language
     * limitation. User code must never call it directly. */
    public constructor(rawEntity: MC.Entity) {
        this.#entity = rawEntity;
    }

    public get id(): string {
        return this.#entity.id;
    }

    public get typeId(): string {
        return this.#entity.typeId;
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
            // No constraints is requested on the type of the property.
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
}

export interface ItemUseEvent {
    readonly item: ItemStack;
    readonly source: Entity;
}
