import { detailedTypeOf } from "./detailed-type-of.js";

type CacheMap = WeakMap<any, WeakMap<any, boolean>>;

/** See https://github.com/chaijs/deep-eql */
export function deepEqual(x: any, y: any): boolean {
    return deepEqual_(x, y);
}

export function deepEqual_(x: any, y: any, cache?: CacheMap): boolean {
    const sEq = simpleEqual(x, y);
    if (sEq !== undefined) {
        return sEq;
    }
    else {
        return extensiveDeepEqual(x, y, cache);
    }
}

function simpleEqual(x: any, y: any): boolean|undefined {
    if (x === y) {
        // It gives us a false positive for +0 and -0. Distinguish them.
        return x !== 0 || 1/x === 1/y;
    }
    else if (x !== x && y !== y) {
        // Both x and y are NaN.
        return true;
    }
    else if (isPrimitive(x) || isPrimitive(y)) {
        // If at least one of x and y are primitives, x === y would have
        // passed the first equality check.
        return false;
    }
    else {
        return undefined;
    }
}

function extensiveDeepEqual(x: any, y: any, cache = new WeakMap()): boolean {
    const cEq = cachedEqual(x, y, cache);
    if (cEq != null) {
        return cEq;
    }
    else {
        const xType = detailedTypeOf(x);
        if (xType !== detailedTypeOf(y)) {
            return cacheEquality(x, y, cache, false);
        }
        else {
            // x and y have the same type. Temporarily store an equality in
            // the cache to prevent circular references from overflowing
            // the stack.
            cacheEquality(x, y, cache, true);

            const result = extensiveDeepEqualByType(x, y, cache, xType);
            return cacheEquality(x, y, cache, result);
        }
    }
}

function extensiveDeepEqualByType(x: any, y: any, cache: CacheMap, ty: string): boolean {
    switch (ty) {
        case "Number":
        case "String":
        case "Boolean":
        case "BigInt":
        case "Symbol":
            // These are boxed primitives. Compare their primitive values.
            return deepEqual(x.valueOf(), y.valueOf());

        case "Function":
        case "GeneratorFunction":
        case "AsyncGeneratorFunction":
        case "Promise":
        case "WeakMap":
        case "WeakSet":
            // These types are opaque, that is, we cannot compare them by
            // looking into their properties.
            return x === y;

        case "Error":
            return keysEqual(x, y, ["name", "message"], cache);

        case "Arguments":
        case "Array":
        case "Int8Array":
        case "Uint8Array":
        case "Uint8ClampedArray":
        case "Int16Array":
        case "Uint16Array":
        case "Int32Array":
        case "Uint32Array":
        case "Float32Array":
        case "Float64Array":
        case "BigInt64Array":
        case "BigUint64Array":
            return arrayEqual(x, y, cache);

        case "Set":
        case "Map":
            return unorderedContainerEqual(x, y, cache);

        case "DataView":
            return arrayBufferEqual(x.buffer, y.buffer, cache);

        case "ArrayBuffer":
        case "SharedArrayBuffer":
            return arrayBufferEqual(x, y, cache);

        case "RegExp":
            return stringEqual(x, y);

        default:
            return objectEqual(x, y, cache);
    }
}

function cachedEqual(x: any, y: any, cache: CacheMap): boolean|undefined {
    // WeakMap keys can *only* be objects, not primitives.
    if (isPrimitive(x) || isPrimitive(y)) {
        return undefined;
    }
    else {
        const xMap = cache.get(x);
        if (xMap) {
            const cached = xMap.get(y);
            if (cached !== undefined) {
                return cached;
            }
        }

        const yMap = cache.get(y);
        if (yMap) {
            const cached = yMap.get(x);
            if (cached !== undefined) {
                return cached;
            }
        }

        return undefined;
    }
}

function cacheEquality(x: any, y: any, cache: CacheMap, result: boolean): boolean {
    // WeakMap keys can *only* be objects, not primitives.
    if (isPrimitive(x) || isPrimitive(y)) {
        return result;
    }
    else {
        let xMap = cache.get(x);
        if (xMap) {
            xMap.set(y, result);
        }
        else {
            xMap = new WeakMap();
            xMap.set(y, result);
            cache.set(x, xMap);
        }
        return result;
    }
}

function arrayEqual(x: any, y: any, cache: CacheMap): boolean {
    if (x.length !== y.length) {
        return false;
    }
    else if (x.length === 0) {
        return true;
    }
    else {
        return iterableEqual(x, y, cache);
    }
}

function arrayBufferEqual(x: any, y: any, cache: CacheMap): boolean {
    if (x.byteLength !== y.byteLength) {
        return false;
    }
    else if (x.byteLength === 0) {
        return true;
    }
    else {
        return iterableEqual(new Uint8Array(x), new Uint8Array(y), cache);
    }
}

function stringEqual(x: any, y: any): boolean {
    return x.toString() === y.toString();
}

function unorderedContainerEqual(x: any, y: any, cache: CacheMap): boolean {
    if (x.size !== y.size) {
        return false;
    }
    else if (x.size === 0) {
        return true;
    }
    else {
        const xs = Array.from(x.entries());
        const ys = Array.from(y.entries());
        xs.sort();
        ys.sort();
        return iterableEqual(xs, ys, cache);
    }
}

function iterableEqual(x: any, y: any, cache: CacheMap): boolean {
    const xIt = x[Symbol.iterator]();
    const yIt = y[Symbol.iterator]();

    while (true) {
        const xElem = xIt.next();
        const yElem = yIt.next();

        if (xElem.done !== yElem.done) {
            return false;
        }
        else if (xElem.done) {
            return true;
        }
        else if (!deepEqual_(xElem.value, yElem.value, cache)) {
            return false;
        }
    }
}

function objectEqual(x: any, y: any, cache: CacheMap): boolean {
    const xKeys = getAllKeys(x);
    const yKeys = getAllKeys(y);

    if (xKeys.length !== yKeys.length) {
        return false;
    }
    else {
        xKeys.sort();
        yKeys.sort();
        if (!iterableEqual(xKeys, yKeys, cache)) {
            return false;
        }
        else {
            return keysEqual(x, y, xKeys, cache);
        }
    }
}

function getAllKeys(obj: any): PropertyKey[] {
    const names: PropertyKey[] = Object.getOwnPropertyNames(obj);
    const syms:  PropertyKey[] = Object.getOwnPropertySymbols(obj);
    const keys:  PropertyKey[] = names.concat(syms);

    const proto = Object.getPrototypeOf(obj);
    if (proto == null) {
        return keys;
    }
    else {
        return keys.concat(getAllKeys(proto));
    }
}

function keysEqual(x: any, y: any, keys: PropertyKey[], cache: CacheMap): boolean {
    for (const key of keys) {
        if (!deepEqual_(x[key], y[key], cache)) {
            return false;
        }
    }
    return true;
}

function isPrimitive(x: any): boolean {
    return x === null || typeof x !== "object";
}
