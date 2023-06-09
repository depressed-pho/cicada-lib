import { IEventSignal, GluedEventSignalWithoutOptions,
         GluedEventSignalWithOptions } from "../event.js";
import { ScriptEventCommandMessageAfterEvent } from "../script-event.js";
import { WatchdogTerminateBeforeEvent } from "../watchdog.js";
import { Wrapper } from "../wrapper.js";
import { identity } from "../function.js";
import * as MC from "@minecraft/server";

export class SystemAfterEvents extends Wrapper<MC.SystemAfterEvents> {
    public readonly scriptEventReceive: IEventSignal<ScriptEventCommandMessageAfterEvent, MC.ScriptEventMessageFilterOptions>;

    /** Package private: user code should not use this. */
    public constructor(rawEvents: MC.SystemAfterEvents) {
        super(rawEvents);
        this.scriptEventReceive = new GluedEventSignalWithOptions(
            this.raw.scriptEventReceive,
            (rawEv: MC.ScriptEventCommandMessageAfterEvent) => {
                return new ScriptEventCommandMessageAfterEvent(rawEv);
            },
            identity);
    }
}

export class SystemBeforeEvents extends Wrapper<MC.SystemBeforeEvents> {
    public readonly watchdogTerminate: IEventSignal<WatchdogTerminateBeforeEvent>;

    /** Package private: user code should not use this. */
    public constructor(rawEvents: MC.SystemBeforeEvents) {
        super(rawEvents);
        this.watchdogTerminate = new GluedEventSignalWithoutOptions(
            this.raw.watchdogTerminate,
            (rawEv: MC.WatchdogTerminateBeforeEvent) => {
                return new WatchdogTerminateBeforeEvent(rawEv);
            });
    }
}
