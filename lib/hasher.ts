import { Buffer } from "./stream.js";
import { XXH32 } from "./xxhash.js";

/** Universal hasher of ECMAScript values. This uses 32-bit xxHash as the
 * underlying hash function so the output is always a 32-bit integer. Note
 * that this hasher is not stable across versions. Do not serialise hashes
 * it generates.
 */
export class Hasher extends XXH32 {
    readonly #buffer: Buffer;

    public constructor(seed = 0) {
        super(seed);
        this.#buffer = new Buffer();
    }

    public override update(value: any): void {
        switch (typeof value) {
            case "undefined":
                this.#updateWithUint8(0x00);
                break;
            case "boolean":
                this.#updateWithUint8(0x01);
                this.#updateWithUint8(value ? 1 : 0);
                break;
            case "number":
                this.#updateWithUint8(0x02);
                this.#updateWithNumber(value);
                break;
            case "bigint":
                // Is there anything we can do better than this?
                this.#updateWithUint8(0x03);
                this.#updateWithString(value.toString(36));
                break;
            case "string":
                this.#updateWithUint8(0x04);
                this.#updateWithString(value);
                break;
            case "symbol":
                this.#updateWithUint8(0x05);
                this.#updateWithString(value.toString());
                break;
            case "function":
                throw new TypeError("Functions cannot be hashed");
            case "object":
                this.#updateWithUint8(0xFF);
                this.#updateWithObject(value);
                break;
            default:
                throw new TypeError(`Unknown value type: ${typeof value}`);
        }
    }

    #updateWithUint8(u8: number) {
        this.#buffer.clear();
        this.#buffer.appendUint8(u8);
        super.update(this.#buffer);
    }

    #updateWithUint16(u16: number) {
        this.#buffer.clear();
        this.#buffer.appendUint16(u16);
        super.update(this.#buffer);
    }

    #updateWithUint32(u32: number) {
        this.#buffer.clear();
        this.#buffer.appendUint32(u32);
        super.update(this.#buffer);
    }

    #updateWithNumber(num: number) {
        this.#buffer.clear();
        this.#buffer.appendFloat64(num);
        super.update(this.#buffer);
    }

    #updateWithString(str: string) {
        this.#updateWithUint32(str.length);
        for (let i = 0; i < str.length; i++) {
            this.#updateWithUint16(str.charCodeAt(i));
        }
    }

    #updateWithObject(obj: any) {
        if (Array.isArray(obj)) {
            this.#updateWithUint8(0x00);
            this.#updateWithUint32(obj.length);
            for (const elem of obj) {
                this.update(elem);
            }
        }
        else if (ArrayBuffer.isView(obj)) {
            this.#updateWithUint8(0x01);
            this.#updateWithUint32(obj.byteLength);
            if (obj instanceof Uint8Array)
                super.update(obj);
            else
                super.update(new Uint8Array(obj.buffer, obj.byteOffset));
        }
        else if (obj instanceof ArrayBuffer || obj instanceof SharedArrayBuffer) {
            this.#updateWithUint8(0x01);
            this.#updateWithUint32(obj.byteLength);
            super.update(new Uint8Array(obj));
        }
        else if (obj instanceof Set) { // Not great, but there is no Set.isSet().
            throw new TypeError("The hash value of a Set cannot be computed because it's unordered");
        }
        else if (obj instanceof Map) {
            throw new TypeError("The hash value of a Map cannot be computed because it's unordered");
        }
        else if (obj instanceof RegExp) {
            this.#updateWithUint8(0x02);
            this.#updateWithString(obj.toString());
        }
        else if (obj instanceof Date) {
            this.#updateWithUint8(0x03);
            this.#updateWithNumber(obj.valueOf());
        }
        else if (obj instanceof Promise) {
            throw new TypeError("The hash value of a Promise cannot be computed");
        }
        else if (obj instanceof WeakSet || obj instanceof WeakMap) {
            throw new TypeError("The hash value of weak containers cannot be computed");
        }
        else if ("WeakRef" in globalThis && obj instanceof WeakRef) {
            throw new TypeError("The hash value of a WeakRef cannot be computed");
        }
        else if (Hasher.#maybeUnbox(obj) !== undefined) {
            this.#updateWithUint8(0x04);
            this.update(Hasher.#maybeUnbox(obj));
        }
        else {
            this.#updateWithUint8(0xFF);

            const ownProps = Object.entries(Object.getOwnPropertyDescriptors(obj));
            this.#updateWithUint32(ownProps.length);

            for (const [key, desc] of ownProps) {
                this.update(key);
                if (desc.value !== undefined) {
                    this.update(desc.value);
                }
                else if (desc.get !== undefined) {
                    this.update(desc.get.call(obj));
                }
                else {
                    this.update(undefined);
                }
            }
        }
    }

    static #maybeUnbox(obj: any): unknown {
        if (obj.constructor &&
            obj.constructor.prototype &&
            typeof obj.constructor.prototype.valueOf === "function") {

            // Looks like a boxed primitive. Try calling valueOf().
            try {
                const prim = obj.constructor.prototype.valueOf.call(obj);
                if (typeof prim === "object")
                    // It actually wasn't.
                    return undefined;
                else
                    // It was!
                    return prim;
            }
            catch {
                // Seems like it wasn't.
                return undefined;
            }
        }
        else {
            // It doesn't look like a boxed primitive.
            return undefined;
        }
    }
}
