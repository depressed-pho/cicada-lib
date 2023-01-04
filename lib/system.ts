import { EventEmitter } from "./event-emitter.js"
import { BeforeWatchdogTerminateEvent } from "./watchdog.js";
import * as MC from "@minecraft/server";

export class System extends EventEmitter {
    readonly #system: MC.System;

    /** The constructor is public only because of a language
     * limitation. User code must never call it directly. */
    public constructor(rawSystem: MC.System) {
        super();

        this.#system = rawSystem;

        this.#glueEvents();
    }

    #glueEvents(): void {
        this.#system.events.beforeWatchdogTerminate.subscribe(rawEv => {
            const ev = new BeforeWatchdogTerminateEvent(rawEv);
            this.emit("beforeWatchdogTerminate", ev);
        });
    }
}

export const system = new System(MC.system);
