import { IEventSignal, /*GluedEventSignalWithoutOptions,*/
         GluedEventSignalWithOptions } from "../event.js";
import { ScriptEventCommandMessageAfterEvent } from "../script-event.js";
//import { WatchdogTerminateBeforeEvent } from "../watchdog.js";
import { Wrapper } from "../wrapper.js";
import { identity } from "../function.js";
import type { StartupEvent } from "@minecraft/server";
import * as MC from "@minecraft/server";

export class SystemAfterEvents extends Wrapper<MC.SystemAfterEvents> {
    public readonly scriptEventReceive: IEventSignal<ScriptEventCommandMessageAfterEvent, MC.ScriptEventMessageFilterOptions>;

    /// @internal
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
    public readonly startup: IEventSignal<StartupEvent>;
    //public readonly watchdogTerminate: IEventSignal<WatchdogTerminateBeforeEvent>; // FIXME: Uncomment this when it's released.

    /// @internal
    public constructor(rawEvents: MC.SystemBeforeEvents) {
        super(rawEvents);
        this.startup = this.raw.startup;
        /*
        this.watchdogTerminate = new GluedEventSignalWithoutOptions(
            this.raw.watchdogTerminate,
            (rawEv: MC.WatchdogTerminateBeforeEvent) => {
                return new WatchdogTerminateBeforeEvent(rawEv);
            });
        */
    }
}
