import { detailedTypeOf } from "../detailed-type-of.js";
import { inspect } from "../inspect.js";
import { KeyPath, Index } from "./schema.js";
import * as PB from "./table_pb.js";
import { Timestamp } from "./google/protobuf/timestamp_pb.js";

/* The TypedArray constructor: used for checking if an object is some kind
 * of TypedArray.
 */
const TypedArray: Function =
    Object.getPrototypeOf(Int8Array);

export type Key =
    number | Date | string | Uint8Array | Key[] |
    typeof MIN_KEY | typeof MAX_KEY;

export type KeyRange = typeof SINGLETON | {min: Key, max: Key};

export const SINGLETON: unique symbol = Symbol("SINGLETON");
export const MIN_KEY:   unique symbol = Symbol("MIN_KEY");
export const MAX_KEY:   unique symbol = Symbol("MAX_KEY");

function keyTypeOf(key: Key): string {
    const primType = typeof key;
    switch (primType) {
        case "symbol":
            if (key === MIN_KEY)
                return "MIN_KEY";
            else if (key === MAX_KEY)
                return "MAX_KEY";
            else
                break;
        case "string":
        case "number":
            return primType;
        case "object":
            if (Array.isArray(key))
                return "Array";
            else if (key instanceof Uint8Array)
                return "Uint8Array";
            else if (key instanceof Date)
                return "Date";
            else
                break;
        default:
            break;
    }
    throw new TypeError(`${String(key)} is not a valid key`);
}

export function cloneKey(key: Key): Key {
    const primType = typeof key;

    if (primType !== "object") {
        return key;
    }
    else if (Array.isArray(key)) {
        return key.map(cloneKey);
    }
    else if (key instanceof Uint8Array) {
        return new Uint8Array(key);
    }
    else if (key instanceof Date) {
        return new Date(key);
    }
    else {
        throw new TypeError(`${String(key)} is not a valid key`);
    }
}

export function inspectKey(key: Key): string {
    return inspect(key, {colors: true, compact: true});
}

export function equalKeys(a: Key, b: Key): boolean {
    const ta = keyTypeOf(a);
    const tb = keyTypeOf(b);
    if (ta !== tb) {
        return false;
    }
    else {
        switch (ta) {
            case "symbol":
                return true; // MIN_KEY == MIN_KEY, MAX_KEY == MAX_KEY.
            case "number":
            case "Date":
            case "string":
                return a == b;
            case "Array":
                return equalArrays(a as Key[], b as Key[]);
            case "Uint8Array":
                return equalOctets(a as Uint8Array, b as Uint8Array);
            default:
                throw new TypeError(`${String(a)} and ${String(b)} are not comparable`);
        }
    }
}

// Compare keys according to the rule described in
// https://www.w3.org/TR/IndexedDB/#key-construct
export function compareKeys(a: Key, b: Key): -1|0|1 {
    const ta = keyTypeOf(a);
    const tb = keyTypeOf(b);
    if (ta !== tb) {
        return ta === "MAX_KEY"    ?  1
             : tb === "MAX_KEY"    ? -1
             : ta === "Array"      ?  1
             : tb === "Array"      ? -1
             : ta === "Uint8Array" ?  1
             : tb === "Uint8Array" ? -1
             : ta === "string"     ?  1
             : tb === "string"     ? -1
             : ta === "Date"       ?  1
             : tb === "Date"       ? -1
             : ta === "number"     ?  1  // tb must be a MIN_KEY.
             :                       -1; // tb must be a number.
    }
    else {
        switch (ta) {
            case "symbol":
                return 0; // MIN_KEY == MIN_KEY, MAX_KEY == MAX_KEY.
            case "number":
            case "Date":
            case "string":
                // TypeScript cannot infer that neither a nor b is a
                // symbol.
                return (a as any) > (b as any) ?  1
                     : (a as any) < (b as any) ? -1
                     :                            0;
            case "Array":
                return compareArrays(a as Key[], b as Key[]);
            case "Uint8Array":
                return compareOctets(a as Uint8Array, b as Uint8Array);
            default:
                throw new TypeError(`${String(a)} and ${String(b)} are not comparable`);
        }
    }
}

function equalArrays(a: Key[], b: Key[]): boolean {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++)
        if (!equalKeys(a[i]!, b[i]!))
            return false;
    return true;
}

function compareArrays(a: Key[], b: Key[]): -1|0|1 {
    for (let i = 0;; i++) {
        if (i === a.length) {
            if (i === b.length)
                return 0;
            else
                return -1; // "a" is shorter than "b".
        }
        else if (i === b.length) {
            return 1; // "a" is longer than "b".
        }
        else {
            const cmp = compareKeys(a[i]!, b[i]!);
            if (cmp !== 0)
                return cmp;
        }
    }
}

function equalOctets(a: ArrayLike<unknown>, b: ArrayLike<unknown>): boolean {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++)
        if (a[i] !== b[i])
            return false;
    return true;
}

function compareOctets(a: ArrayLike<unknown>, b: ArrayLike<unknown>): -1|0|1 {
    for (let i = 0;; i++) {
        if (i === a.length) {
            if (i === b.length)
                return 0;
            else
                return -1; // "a" is shorter than "b".
        }
        else if (i === b.length) {
            return 1; // "a" is longer than "b".
        }
        else if (a[i]! > b[i]!) {
            return 1;
        }
        else if (a[i]! < b[i]!) {
            return -1;
        }
    }
}

// Convert a value into a valid key if possible. See
// https://www.w3.org/TR/IndexedDB/#convert-a-value-to-a-key
export function toKey(val: any): Key {
    switch (detailedTypeOf(val)) {
        case "number":
            if (Number.isNaN(val))
                throw new TypeError(`${val} is not a valid key`);
            else
                return val;
        case "Date":
            if (Number.isNaN(val.getUTCMilliseconds()))
                throw new TypeError(`${val} is not a valid key`);
            else
                return val;
        case "string":
            return val;
        case "ArrayBuffer":
            return new Uint8Array(val);
        case "Uint8Array":
            return val;
        case "Array":
            return val;
        default:
            if (val instanceof TypedArray)
                // @ts-ignore: TypeScript doesn't know it's a TypedArray object.
                return new Uint8Array(val.buffer, val.byteOffset, val.byteLength);
            else
                throw new TypeError(`${val} is not a valid key`);
    }
}

/// Extract a single key from an object. Throws an error if the index is
/// multi-entry.
export function extractKey(idx: Index, obj: any): Key {
    if (idx.isMulti) {
        throw new Error("Internal error: cannot use extractKey() for multi-entry indices");
    }
    switch (idx.keyPaths.length) {
        case 0: // Extrinsic
            throw new Error("Internal error: attempted to extract an intrinsic primary key when there is none");

        case 1: // Non-compound
            return toKey(evalPath(idx.keyPaths[0]!, obj));

        default: // Compound
            return idx.keyPaths.map(kp => toKey(evalPath(kp, obj)));
    }
}

/// Extract keys from an object. The resulting iterable will be a singleton
/// if the index isn't multi-entry.
export function* extractKeys(idx: Index, obj: any): Iterable<Key> {
    switch (idx.keyPaths.length) {
        case 0: // Extrinsic
            throw new Error("Internal error: attempted to extract an intrinsic primary key when there is none");

        case 1: // Non-compound
            if (idx.isMulti) {
                for (const key of evalPathMulti(idx.keyPaths[0]!, obj)) {
                    yield toKey(key);
                }
            }
            else {
                yield toKey(evalPath(idx.keyPaths[0]!, obj));
            }
            break;

        default: // Compound
            if (idx.isMulti) {
                throw new Error("Internal error: attempted to extract multi-entry keys for a compound index");
            }
            else {
                yield idx.keyPaths.map(kp => toKey(evalPath(kp, obj)));
            }
    }
}

export function evalPath(kp: KeyPath, obj: any): any {
    for (const name of kp) {
        if (typeof obj === "object") {
            obj = obj[name];
        }
        else {
            throw new TypeError(`${obj} is not an object`);
        }
    }
    return obj;
}

export function* evalPathMulti(kp: KeyPath, obj: any): Iterable<any> {
    for (let i = 0; i < kp.length; i++) {
        const name = kp[i]!;
        if (Array.isArray(obj)) {
            for (const elem of obj) {
                yield* evalPathMulti(kp.slice(i), elem);
            }
            return;
        }
        else if (typeof obj === "object") {
            obj = obj[name];
        }
    }
    if (Array.isArray(obj)) {
        yield* obj;
    }
    else {
        yield obj;
    }
}

export function setValueAtPath(kp: KeyPath, value: any, obj: any): void {
    for (let i = 0; i < kp.length; i++) {
        if (typeof obj === "object") {
            const name = kp[i]!;
            if (i + 1 < kp.length) {
                obj = obj[name];
            }
            else {
                if (obj[name] == undefined) {
                    obj[name] = value;
                }
                else {
                    throw new TypeError(`${obj} already has a property ${name}`);
                }
            }
        }
        else {
            throw new TypeError(`${obj} is not an object`);
        }
    }
}

export function readKey(key: PB.Key): Key {
    const v = key.variant;
    switch (v.oneofKind) {
        case "numberKey": return v.numberKey;
        case "dateKey":   return Timestamp.toDate(v.dateKey);
        case "stringKey": return v.stringKey;
        case "bytesKey":  return v.bytesKey;
        case "arrayKey":  return v.arrayKey.elems.map(readKey);
        default:
            throw new TypeError(`Unknown key kind: ${v.oneofKind}`);
    }
}

export function writeKey(key: Key): PB.Key {
    switch (typeof key) {
        case "number":
            return {
                variant: {
                    oneofKind: "numberKey",
                    numberKey: key
                }
            };
        case "string":
            return {
                variant: {
                    oneofKind: "stringKey",
                    stringKey: key
                }
            };
        case "object":
            if (Array.isArray(key))
                return {
                    variant: {
                        oneofKind: "arrayKey",
                        arrayKey: {
                            elems: key.map(writeKey)
                        }
                    }
                };
            else if (key instanceof Uint8Array)
                return {
                    variant: {
                        oneofKind: "bytesKey",
                        bytesKey: key
                    }
                };
            else if (key instanceof Date)
                return {
                    variant: {
                        oneofKind: "dateKey",
                        dateKey: Timestamp.fromDate(key)
                    }
                };
            break;
        default:
            break;
    }
    throw new TypeError(`${String(key)} is not a valid key`);
}
