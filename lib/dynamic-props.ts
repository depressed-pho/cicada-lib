import { Constructor } from "./mixin.js";
import { Wrapper } from "./wrapper.js";
import { Vector3 } from "@minecraft/server";

export interface ObjectWithDynamicProperties {
    getDynamicProperty(identifier: string): boolean|number|string|Vector3|undefined;
    getDynamicPropertyIds(): string[];
    getDynamicPropertyTotalByteCount(): number;
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

/** A mixin for objects that have dynamic properties, such as Entity or
 * World.
 */
export function HasDynamicProperties<T extends Constructor<Wrapper<ObjectWithDynamicProperties>>>(base: T) {
    return class HasDynamicProperties extends base {
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

        public setDynamicProperty(identifier: string,
                                  value: boolean|number|string|Vector3|undefined): void {
            this.raw.setDynamicProperty(identifier, value);
        }
    };
}
