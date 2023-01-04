/** Preferences in an arbitrary data structure that can be expressed in
 * Protocol Buffers proto3. They come in two flavours: per-player and
 * per-world preferences. Note that this module isn't meant for direct use.
 */
import "./shims/text-decoder.js";
import "./shims/text-encoder.js";
import { MessageType } from "@protobuf-ts/runtime";
import { decodeOctets, encodeOctets } from "./octet-stream.js";

export function decodeOrCreate<T extends object>(ty: MessageType<T>,
                                                 prefs: string|undefined): T {
    if (prefs === undefined) {
        return ty.create();
    }
    else {
        try {
            const bin = decodeOctets(prefs);
            return ty.fromBinary(bin);
        }
        catch (e) {
            console.error("Preference corrupted. Resetting: %o", e);
            return ty.create();
        }
    }
}

export function encode<T extends object>(ty: MessageType<T>, prefs: T): string {
    const bin = ty.toBinary(prefs);
    return encodeOctets(bin);
}
