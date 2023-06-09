import { Wrapper } from "./wrapper.js";
import { WatchdogTerminateReason } from "@minecraft/server";
import * as MC from "@minecraft/server";

export { WatchdogTerminateReason };

export class WatchdogTerminateBeforeEvent extends Wrapper<MC.WatchdogTerminateBeforeEvent> {
    /** Package private: user code should not use this. */
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
