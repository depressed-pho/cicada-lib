/** Preferences in an arbitrary data structure that can be expressed in
 * Protocol Buffers proto3. They come in two flavours: per-player and
 * per-world preferences.
 */
import "./shims/text-decoder.js";
import "./shims/text-encoder.js";
import { MessageType } from "@protobuf-ts/runtime";
import * as CicASCII from "./cic-ascii.js";
import * as MC from "@minecraft/server";

let addonNamespace:   string|null = null;
let worldInitialised: boolean     = false;

/** Declare the namespace of your addon. You must call this function on the
 * top level of your script, not in an event handler. */
export function declareNamespace(ns: string): void {
    if (worldInitialised) {
        throw new Error(
            "Attempted to declare the addon namespace after initialising the world. It's too late.");
    }
    else {
        addonNamespace = ns;
    }
}

/** Package private */
export function dynamicPropertyId(type: "player"|"world"): string {
    if (addonNamespace == null) {
        throw new Error("No namespaces have been declared for the addon.");
    }
    else {
        return `${addonNamespace}:${type}-preferences`;
    }
}

MC.world.events.worldInitialize.subscribe(ev => {
    if (addonNamespace != null) {
        const props = new MC.DynamicPropertiesDefinition();

        props.defineString(dynamicPropertyId("player"), 950); // Undocumented maximum at 1000
        ev.propertyRegistry.registerEntityTypeDynamicProperties(
            props, MC.MinecraftEntityTypes.player);
        // Seriously, only a thousand characters? We will probably have to
        // split our data in several properties then...
    }
});

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
