import * as PB from "./table_pb.js";
import { NullValue } from "./google/protobuf/struct_pb.js";
import { Timestamp } from "./google/protobuf/timestamp_pb.js";

/** Things that can be stored in the database.
 */
export type Storable =
    null                      |
    boolean                   |
    number                    |
    string                    |
    Uint8Array                |
    Storable[]                |
    // This can't be Record<string, Storable> due to
    // https://github.com/microsoft/TypeScript/issues/35164
    {[key: string]: Storable} |
    Date;

/** Deep-clone the given storable object. Note that `T` must satisfy
 * `Storable` but this constraint cannot be expressed in TypeScript due to
 * https://github.com/microsoft/TypeScript/issues/35164
 */
export function cloneStorable<T>(value: T): T {
    switch (typeof value) {
        case "boolean":
        case "number":
        case "string":
            return value;
        case "object":
            if (value === null)
                return value;
            else if (Array.isArray(value))
                return value.map(cloneStorable) as T;
            else if (value instanceof Uint8Array)
                return new Uint8Array(value) as T;
            else if (value instanceof Date)
                return new Date(value) as T;
            else {
                const ret: any = {};
                for (const [name, desc] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
                    if (typeof name !== "string") {
                        throw new TypeError(`Object properties with non-string names can not be cloned: ${String(name)}`);
                    }
                    else if ((desc as any).get || (desc as any).set) {
                        throw new TypeError(`Object properties with getter/setter can not be cloned: ${name}`);
                    }
                    else {
                        Object.defineProperty(ret, name, desc);
                    }
                }
                return ret;
            }
        default:
            throw new TypeError(`${String(value)} is not a storable value`);
    }
}

export function readStorable(value: PB.Value): Storable {
    const v = value.variant;
    switch (v.oneofKind) {
        case "nullValue":    return null;
        case "booleanValue": return v.booleanValue;
        case "numberValue":  return v.numberValue;
        case "stringValue":  return v.stringValue;
        case "bytesValue":   return v.bytesValue;
        case "arrayValue":   return v.arrayValue.values.map(readStorable);
        case "objectValue":
            const obj: {[key: string]: Storable} = {};
            for (const [propName, propValue] of Object.entries(v.objectValue)) {
                obj[propName] = readStorable(propValue);
            }
            return obj;
        case "dateValue":    return Timestamp.toDate(v.dateValue);
        default:
            throw new TypeError(`Unknown storable kind: ${v.oneofKind}`);
    }
}

export function writeStorable(value: Storable): PB.Value {
    switch (typeof value) {
        case "boolean":
            return {
                variant: {
                    oneofKind: "booleanValue",
                    booleanValue: value
                }
            };
        case "number":
            return {
                variant: {
                    oneofKind: "numberValue",
                    numberValue: value
                }
            };
        case "string":
            return {
                variant: {
                    oneofKind: "stringValue",
                    stringValue: value
                }
            };
        case "object":
            if (value === null)
                return {
                    variant: {
                        oneofKind: "nullValue",
                        nullValue: NullValue.NULL_VALUE
                    }
                };
            else if (Array.isArray(value))
                return {
                    variant: {
                        oneofKind: "arrayValue",
                        arrayValue: {
                            values: value.map(writeStorable)
                        }
                    }
                };
            else if (value instanceof Uint8Array)
                return {
                    variant: {
                        oneofKind: "bytesValue",
                        bytesValue: value
                    }
                };
            else if (value instanceof Date)
                return {
                    variant: {
                        oneofKind: "dateValue",
                        dateValue: Timestamp.fromDate(value)
                    }
                };
            else {
                const obj: {[key: string]: PB.Value} = {};
                for (const [propName, propValue] of Object.entries(value)) {
                    obj[propName] = writeStorable(propValue);
                }
                return {
                    variant: {
                        oneofKind: "objectValue",
                        objectValue: {
                            object: obj
                        }
                    }
                };
            }
        default:
            throw new TypeError(`${String(value)} is not a storable value`);
    }
}
