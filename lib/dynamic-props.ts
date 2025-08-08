import { Conduit, conduit, sinkString, takeE, yieldC } from "./conduit.js";
import { Constructor } from "./mixin.js";
import { Wrapper } from "./wrapper.js";
import { Vector3 } from "@minecraft/server";

/** The maximum number of octets that a string property can have. It was
 * ~10 KiB before 1.2.10, and was expanded to 128 KiB for entities and 1
 * MiB for worlds, and then narrowed down to 32 KiB on 1.20.40.
 */
export const MAX_STRING_PROPERTY_LENGTH = 32767;

export interface ObjectWithDynamicProperties {
    clearDynamicProperties(): void;
    getDynamicProperty(identifier: string): boolean|number|string|Vector3|undefined;
    getDynamicPropertyIds(): string[];
    getDynamicPropertyTotalByteCount(): number;
    setDynamicProperties(values: Record<string, boolean|number|string|Vector3>): void;
    setDynamicProperty(identifier: string, value?: boolean|number|string|Vector3): void;
}

export interface IHasDynamicProperties {
    get dynamicPropertyIds(): string[];
    get dynamicPropertyTotalByteCount(): number;
    clearDynamicProperties(): void;
    getDynamicProperty(identifier: string): boolean|number|string|Vector3|undefined;
    getDynamicProperty<Ty extends keyof DynamicPropertyTypeMap>(identifier: string, ty: Ty): DynamicPropertyTypeMap[Ty];
    setDynamicProperties(values: Record<string, boolean|number|string|Vector3>): void;
    setDynamicProperty(identifier: string, value?: boolean|number|string|Vector3): void;
}

export type DynamicPropertyTypeMap = {
    "boolean?": boolean|undefined,
    "number?" : number |undefined,
    "string?" : string |undefined,
    "Vector3?": Vector3|undefined,
    "boolean" : boolean,
    "number"  : number,
    "string"  : string,
    "Vector3" : Vector3,
};

/** A mixin for objects that have dynamic properties, such as Entity,
 * ItemStack, and World.
 */
export function HasDynamicProperties<T extends Constructor<Wrapper<ObjectWithDynamicProperties>>>(base: T) {
    abstract class HasDynamicProperties extends base {
        public get dynamicPropertyIds(): string[] {
            return this.raw.getDynamicPropertyIds();
        }

        public get dynamicPropertyTotalByteCount(): number {
            return this.raw.getDynamicPropertyTotalByteCount();
        }

        public clearDynamicProperties(): void {
            this.raw.clearDynamicProperties();
        }

        public getDynamicProperty(identifier: string): boolean|number|string|Vector3|undefined;

        public getDynamicProperty<Ty extends keyof DynamicPropertyTypeMap>(
            identifier: string, ty: Ty): DynamicPropertyTypeMap[Ty];

        public getDynamicProperty(identifier: string, ty?: string): boolean|number|string|Vector3|undefined {
            const prop = this.raw.getDynamicProperty(identifier);

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
                        throw new TypeError(`Dynamic property \`${identifier}' is expected to be a ${expectedType} but is actually undefined`);
                    }
                }
                else if (expectedType === "Vector3" && actualType === "object") {
                    return prop;
                }
                else if (expectedType === actualType) {
                    return prop;
                }
                else {
                    throw new TypeError(`Dynamic property \`${identifier} is expected to be a ${expectedType} but is actually a ${actualType}`);
                }
            }
        }

        public setDynamicProperties(values: Record<string, boolean|number|string|Vector3>): void {
            this.raw.setDynamicProperties(values);
        }

        public setDynamicProperty(identifier: string,
                                  value?: boolean|number|string|Vector3): void {
            this.raw.setDynamicProperty(identifier, value);
        }
    }
    return HasDynamicProperties;
}

export function sourceDynamicProperty<T extends IHasDynamicProperties>(
    src: T,
    numChunks: number,
    genId: (index: number) => string
): Conduit<any, string, void> {

    return conduit(function* () {
        for (let i = 0; i < numChunks; i++) {
            const chunk = src.getDynamicProperty(genId(i), "string");
            yield* yieldC(chunk);
        }
    });
}

export function sinkDynamicProperty<T extends IHasDynamicProperties>(
    dest: T,
    oldNumChunks: number,
    genId: (index: number) => string
): Conduit<string, any, number> {

    return conduit(function* () {
        let numChunks = 0;
        for (;; numChunks++) {
            const chunk = yield* takeE(MAX_STRING_PROPERTY_LENGTH).fuse(sinkString);
            if (chunk.length > 0)
                dest.setDynamicProperty(genId(numChunks), chunk);
            else
                break;
        }
        for (let i = numChunks; i < oldNumChunks; i++) {
            // These parts no longer exist. Remove them.
            dest.setDynamicProperty(genId(i), undefined);
        }
        return numChunks;
    });
}
