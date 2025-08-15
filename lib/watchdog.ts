/* FIXME: Uncomment this when watchdog-related events are released.
import { Wrapper } from "./wrapper.js";
import { WatchdogTerminateReason } from "@minecraft/server";
import * as MC from "@minecraft/server";

export { WatchdogTerminateReason };

export class WatchdogTerminateBeforeEvent extends Wrapper<MC.WatchdogTerminateBeforeEvent> {
    /// @internal
    public constructor(rawEvent: MC.WatchdogTerminateBeforeEvent) {
        super(rawEvent);
    }

    public cancel(): void {
        this.raw.cancel = true;
    }

    public get terminateReason(): WatchdogTerminateReason {
        return this.raw.terminateReason;
    }
}
*/
