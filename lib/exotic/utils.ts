/** Utility functions for creating exotic objects whose constructor returns
 * a Proxy object.
 */

/** This is a variant of `Reflect.get()` but can handle Proxy-returning
 * classes.
 *
 * There is a huge problem in handling private fields of Proxy-returning
 * classes. They don't belong to the prototype chain, but stored in "this"
 * objects themselves. But in this case there are two distinct "this"
 * objects: the actual Container and the Proxy. Private fields of Container
 * and its superclasses are stored in the former, and private fields of its
 * subclasses are in the latter. This means we can't even use Reflect.get()
 * to lookup properties correctly, and have to manually trace the prototype
 * chain.
 */
export function getProxiedProperty<T, U extends T>(target: T,
                                                   key: PropertyKey,
                                                   receiver: U,
                                                   boundary: abstract new (...args: any[]) => T
                                                  ): any {
    // We know we can do this because "boundary" is a constructor.
    const boundaryProto = boundary.prototype;

    let obj: any = target;
    let thisObj: T = receiver;

    while (true) {
        if (!obj)
            // Stop as soon as a null prototype is encountered.
            return undefined;

        if (obj === boundaryProto)
            // We have crossed the boundary. Use "target" instead of
            // "receiver" as "this" from now on.
            thisObj = target;

        const desc = Object.getOwnPropertyDescriptor(obj, key);
        if (desc) {
            // Found a property.
            if (desc.get) {
                // This is an accessor property.
                return desc.get.call(thisObj);
            }
            else {
                // This is a data property. If it's a function, we must
                // bind it to the correct "this" object, or it won't be
                // able to access private properties.
                if (typeof desc.value === "function")
                    return desc.value.bind(thisObj);
                else
                    return desc.value;
            }
        }

        obj = Object.getPrototypeOf(obj);
    }
}

/** This is a variant of `Reflect.set()` but can handle Proxy-returning
 * classes.
 * @seealso getProxiedProperty
 */
export function setProxiedProperty<T, U extends T>(target: T,
                                                   key: PropertyKey,
                                                   value: any,
                                                   receiver: U,
                                                   boundary: abstract new (...args: any[]) => T
                                                  ): void {
    // We know we can do this because "boundary" is a constructor.
    const boundaryProto = boundary.prototype;

    let obj: any = target;
    let thisObj: T = receiver;

    while (true) {
        if (!obj)
            // Stop as soon as a null prototype is encountered.
            return undefined;

        if (obj === boundaryProto)
            // We have crossed the boundary. Use "target" instead of
            // "receiver" as "this" from now on.
            thisObj = target;

        const desc = Object.getOwnPropertyDescriptor(obj, key);
        if (desc) {
            // Found a property.
            if (desc.set)
                // This is an accessor property.
                desc.set!.call(thisObj, value)
            else
                // This is a data property.
                (target as any)[key] = value;
        }

        obj = Object.getPrototypeOf(obj);
    }
}
