import { TicksPerSecond, system } from "@minecraft/server";

/** Return a promise which will be resolved after *at least* a given
 * fractional number of seconds have elapsed. The promise will never be
 * rejected.
 */
export function delay(secs: number): Promise<void> {
    const ticks = Math.ceil(secs * TicksPerSecond);
    return delayTicks(ticks);
}

/** Return a promise which will be resolved after a given number of game
 * ticks have elapsed. The promise will never be rejected.
 */
export function delayTicks(ticks: number): Promise<void> {
    return new Promise((resolve) => {
        system.runTimeout(resolve, ticks);
    });
}
