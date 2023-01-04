/** Create a proxy object with a thunk to compute its target. As soon as
 * any of their properties are accessed, the thunk is evaluated and the
 * result is memorised.
 */
export function lazy<T>(thunk: () => T): T {
    let isEvaluated = false;
    let value: T;

    return new Proxy({}, {
        apply(_targ: any, _this: any, args: any[]): any {
            if (!isEvaluated) { value = thunk(); isEvaluated = true }

            return (value as any).call(value, ...args);
        },
        construct(_targ: any, args: any[]): any {
            if (!isEvaluated) { value = thunk(); isEvaluated = true }

            return new (value as any)(...args);
        },
        defineProperty(_targ: any, key: PropertyKey, desc: PropertyDescriptor): boolean {
            if (!isEvaluated) { value = thunk(); isEvaluated = true }

            Object.defineProperty(value, key, desc);
            return true;
        },
        deleteProperty(_targ: any, key: PropertyKey): boolean {
            if (!isEvaluated) { value = thunk(); isEvaluated = true }

            delete (value as any)[key];
            return true;
        },
        get(_targ: any, key: PropertyKey): any {
            if (!isEvaluated) { value = thunk(); isEvaluated = true }

            const prop: any = (value as any)[key];
            if (typeof prop === "function") {
                // If the property is a function, we need to recover "this"
                // or it won't work as a method.
                return prop.bind(value);
            }
            else {
                return prop;
            }
        },
        getOwnPropertyDescriptor(_targ: any, key: PropertyKey): PropertyDescriptor|undefined {
            if (!isEvaluated) { value = thunk(); isEvaluated = true }

            return Object.getOwnPropertyDescriptor(value, key);
        },
        getPrototypeOf(_targ: any): any|null {
            if (!isEvaluated) { value = thunk(); isEvaluated = true }

            return Object.getPrototypeOf(value);
        },
        has(_targ: any, key: PropertyKey): boolean {
            if (!isEvaluated) { value = thunk(); isEvaluated = true }

            return key in (value as any);
        },
        isExtensible(_targ: any): boolean {
            if (!isEvaluated) { value = thunk(); isEvaluated = true }

            return Object.isExtensible(value);
        },
        ownKeys(_targ: any): (string|symbol)[] {
            if (!isEvaluated) { value = thunk(); isEvaluated = true }

            return Reflect.ownKeys(value as any);
        },
        preventExtensions(_targ: any): boolean {
            if (!isEvaluated) { value = thunk(); isEvaluated = true }

            Object.preventExtensions(value);
            return true;
        },
        set(_targ: any, key: PropertyKey, v: any): boolean {
            if (!isEvaluated) { value = thunk(); isEvaluated = true }

            (value as any)[key] = v;
            return true;
        },
        setPrototypeOf(_targ: any, proto: any|null): boolean {
            if (!isEvaluated) { value = thunk(); isEvaluated = true }

            Object.setPrototypeOf(value, proto);
            return true;
        }
    });
}
