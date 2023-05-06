import { Constructor } from "./mixin.js";
import { Wrapper } from "./wrapper.js";

export interface ObjectWithDynamicProperties {
    getDynamicProperty(identifier: string): boolean | number | string | undefined;
    removeDynamicProperty(identifier: string): boolean;
    setDynamicProperty(identifier: string, value: boolean | number | string): void;
}

/** A mixin for objects that have dynamic properties, such as Entity or
 * World.
 */
export function HasDynamicProperties<T extends Constructor<Wrapper<ObjectWithDynamicProperties>>>(base: T) {
    return class HasDynamicProperties extends base {
        public getDynamicProperty(identifier: string): boolean|number|string|undefined;
        public getDynamicProperty(identifier: string, ty: "boolean?"): boolean|undefined;
        public getDynamicProperty(identifier: string, ty: "number?" ): number |undefined;
        public getDynamicProperty(identifier: string, ty: "string?" ): string |undefined;
        public getDynamicProperty(identifier: string, ty: "boolean" ): boolean;
        public getDynamicProperty(identifier: string, ty: "number"  ): number;
        public getDynamicProperty(identifier: string, ty: "string"  ): string |undefined;
        public getDynamicProperty(identifier: string, ty?: string): boolean|number|string|undefined {
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
                else if (expectedType === actualType) {
                    return prop;
                }
                else {
                    throw new TypeError(`Dynamic property \`${identifier} is expected to be a ${expectedType} but is actually a ${actualType}`);
                }
            }
        }

        public removeDynamicProperty(identifier: string): void {
            this.raw.removeDynamicProperty(identifier);
        }

        public setDynamicProperty(identifier: string, value: boolean|number|string): void {
            this.raw.setDynamicProperty(identifier, value);
        }
    };
}
