import { IEventSignal, GluedEventSignalWithoutOptions,
         GluedEventSignalWithOptions } from "../event.js";
import { ScriptEventCommandMessageEvent } from "../script-event.js";
import { BeforeWatchdogTerminateEvent } from "../watchdog.js";
import * as MC from "@minecraft/server";

function identity<T>(x: T): T {
    return x;
}

export class SystemEvents {
    public readonly beforeWatchdogTerminate: IEventSignal<BeforeWatchdogTerminateEvent>;
    public readonly scriptEventReceive:      IEventSignal<ScriptEventCommandMessageEvent, MC.ScriptEventMessageFilterOptions>;

    public constructor(rawSystem: MC.System) {
        const rawEvents = rawSystem.events;

        this.beforeWatchdogTerminate = new GluedEventSignalWithoutOptions(
            rawEvents.beforeWatchdogTerminate,
            (rawEv: MC.BeforeWatchdogTerminateEvent) => {
                return new BeforeWatchdogTerminateEvent(rawEv);
            });
        this.scriptEventReceive = new GluedEventSignalWithOptions(
            rawEvents.scriptEventReceive,
            (rawEv: MC.ScriptEventCommandMessageEvent) => {
                return new ScriptEventCommandMessageEvent(rawEv);
            },
            identity);
    }
}
