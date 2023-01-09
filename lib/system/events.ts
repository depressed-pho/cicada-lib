import { IEventSignal, GluedEventSignal } from "../event.js";
import { BeforeWatchdogTerminateEvent } from "../watchdog.js";
import * as MC from "@minecraft/server";

export class SystemEvents {
    public readonly beforeWatchdogTerminate: IEventSignal<BeforeWatchdogTerminateEvent>;

    public constructor(rawSystem: MC.System) {
        const rawEvents = rawSystem.events;

        this.beforeWatchdogTerminate = new GluedEventSignal(rawEvents.beforeWatchdogTerminate, (rawEv: MC.BeforeWatchdogTerminateEvent) => {
            return new BeforeWatchdogTerminateEvent(rawEv);
        });
    }
}
