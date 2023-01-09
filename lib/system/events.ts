import { IEventSignal, PassThruEventSignal } from "../event.js";
import * as MC from "@minecraft/server";

export class SystemEvents {
    public readonly beforeWatchdogTerminate: IEventSignal<MC.BeforeWatchdogTerminateEvent>;

    public constructor(rawSystem: MC.System) {
        const rawEvents = rawSystem.events;

        this.beforeWatchdogTerminate = new PassThruEventSignal(rawEvents.beforeWatchdogTerminate);
    }
}
