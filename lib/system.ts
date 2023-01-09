import { SystemEvents } from "./system/events.js";
import * as MC from "@minecraft/server";

export class System {
    readonly #system: MC.System;

    /** System event signals */
    public readonly events: SystemEvents;

    /** The constructor is public only because of a language
     * limitation. User code must never call it directly. */
    public constructor(rawSystem: MC.System) {
        this.#system = rawSystem;

        this.events  = new SystemEvents(rawSystem);
    }

    /// Package private
    public get raw(): MC.System {
        return this.#system;
    }
}

export const system = new System(MC.system);
