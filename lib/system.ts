import { SystemAfterEvents, SystemBeforeEvents } from "./system/events.js";
import { Wrapper } from "./wrapper.js";
import * as MC from "@minecraft/server";

export class System extends Wrapper<MC.System> {
    /** System after-event signals */
    public readonly afterEvents: SystemAfterEvents;

    /** System before-event signals */
    public readonly beforeEvents: SystemBeforeEvents;

    /** Package private: user code should not use this. */
    public constructor(rawSystem: MC.System) {
        super(rawSystem);

        // FIXME: In MCBE 1.20.0 MC.System has not transitioned to
        // after/before events yet. Delete this glue code when it's
        // updated.
        this.afterEvents  = new SystemAfterEvents({
            scriptEventReceive: (this.raw as any).events.scriptEventReceive
        } as any);
        this.beforeEvents = new SystemBeforeEvents({
            watchdogTerminate: (this.raw as any).events.beforeWatchdogTerminate
        } as any);

        /* New API
        this.afterEvents  = new SystemAfterEvents(this.raw.afterEvents);
        this.beforeEvents = new SystemBeforeEvents(this.raw.beforeEvents);
        */
    }
}

export const system = new System(MC.system);
