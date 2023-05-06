import { IEventSignal, GluedEventSignalWithoutOptions,
         GluedEventSignalWithOptions } from "../event.js";
import { ScriptEventCommandMessageEvent } from "../script-event.js";
import { BeforeWatchdogTerminateEvent } from "../watchdog.js";
import { Wrapper } from "../wrapper.js";
import * as MC from "@minecraft/server";

function identity<T>(x: T): T {
    return x;
}

export class SystemEvents extends Wrapper<MC.SystemEvents> {
    public readonly beforeWatchdogTerminate: IEventSignal<BeforeWatchdogTerminateEvent>;
    public readonly scriptEventReceive:      IEventSignal<ScriptEventCommandMessageEvent, MC.ScriptEventMessageFilterOptions>;

    public constructor(rawEvents: MC.SystemEvents) {
        super(rawEvents);
        this.beforeWatchdogTerminate = new GluedEventSignalWithoutOptions(
            this.raw.beforeWatchdogTerminate,
            (rawEv: MC.BeforeWatchdogTerminateEvent) => {
                return new BeforeWatchdogTerminateEvent(rawEv);
            });
        this.scriptEventReceive = new GluedEventSignalWithOptions(
            this.raw.scriptEventReceive,
            (rawEv: MC.ScriptEventCommandMessageEvent) => {
                return new ScriptEventCommandMessageEvent(rawEv);
            },
            identity);
    }
}
