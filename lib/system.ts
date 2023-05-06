import { SystemEvents } from "./system/events.js";
import { Wrapper } from "./wrapper.js";
import * as MC from "@minecraft/server";

export class System extends Wrapper<MC.System> {
    /** System event signals */
    public readonly events: SystemEvents;

    /** Package private: user code should not use this. */
    public constructor(rawSystem: MC.System) {
        super(rawSystem);
        this.events = new SystemEvents(this.raw.events);
    }
}

export const system = new System(MC.system);
