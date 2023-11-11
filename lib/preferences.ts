/** Preferences in an arbitrary data structure that can be expressed in
 * Protocol Buffers proto3. They come in two flavours: per-player and
 * per-world preferences.
 */
import "./shims/text-decoder.js";
import "./shims/text-encoder.js";
import { MessageType } from "@protobuf-ts/runtime";
import * as CicASCII from "./cic-ascii.js";

export interface IPreferencesContainer {
    getPreferences<T extends object>(ty: MessageType<T>): T;
    setPreferences<T extends object>(ty: MessageType<T>, prefs: T): void;
}

/** Package private */
export function dynamicPropertyId(type: "player"|"world"): string {
    return `preferences.${type}`;
}

/** Package private */
export function decodeOrCreate<T extends object>(ty: MessageType<T>,
                                                 prefs: string|undefined): T {
    if (prefs === undefined) {
        return ty.create();
    }
    else {
        try {
            const bin = CicASCII.decode(prefs);
            return ty.fromBinary(bin);
        }
        catch (e) {
            console.error("Preference corrupted. Resetting: %o", e);
            return ty.create();
        }
    }
}

/** Package private */
export function encode<T extends object>(ty: MessageType<T>, prefs: T): string {
    const bin = ty.toBinary(prefs);
    return CicASCII.encode(bin);
}
