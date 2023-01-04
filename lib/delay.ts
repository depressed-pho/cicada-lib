import * as MC from "@minecraft/server";

/** Return a promise which will be resolved after *at least* a given
 * fractional number of seconds have elapsed. The promise will never be
 * rejected.
 */
export function delay(secs: number): Promise<unknown> {
    return new Promise((resolve) => {
        setTimeout(resolve, Math.floor(secs * 1000));
    });
}

type TimeoutID = number;
interface Timeout {
    readonly handler: () => any;
    startedAt: number; // epoch ms
    readonly delay: number; // ms
    readonly repeat: boolean;
}
const timeoutMap = new Map<TimeoutID, Timeout>();
let nextTimeoutID = 0;
let runScheduleId: number|null = null;

function mkHandler(arg0: string|Function, ...args: any[]): (() => unknown) {
    return typeof arg0 === "string"
        ? () => eval(arg0)
        : arg0.bind(null, ...args);
}

function onWorldTick() {
    const now = Date.now();
    for (const [tid, t] of timeoutMap) {
        if (t.startedAt + t.delay < now) {
            t.handler();
            if (t.repeat) {
                t.startedAt = now;
            }
            else {
                timeoutMap.delete(tid);
            }
        }
    }
    if (timeoutMap.size == 0) {
        unlistenOnTicks();
    }
}

function listenOnTicks(): void {
    if (runScheduleId == null) {
        runScheduleId = MC.system.runSchedule(onWorldTick, 1);
    }
}

function unlistenOnTicks(): void {
    if (runScheduleId != null) {
        MC.system.clearRunSchedule(runScheduleId);
        runScheduleId = null;
    }
}

/** A low-level implementation of the standard setTimeout() function. This
 * is necessary because the Minecraft API doesn't provide a native
 * setTimeout() and its family.
 */
export function setTimeout(code: string, delay?: number): number;
export function setTimeout(fun: Function, delay?: number, ...args: any[]): number;

export function setTimeout(arg0: string|Function, delay?: number, ...args: any[]): number {
    const tid = ++nextTimeoutID;
    timeoutMap.set(tid, {
        handler:   mkHandler(arg0, ...args),
        startedAt: Date.now(),
        delay:     delay || 0,
        repeat:    false
    });
    listenOnTicks();
    return tid;
}

/** A low-level implementation of the standard setInterval() function.
 */
export function setInterval(code: string, delay?: number): number;
export function setInterval(fun: Function, delay?: number, ...args: any[]): number;

export function setInterval(arg0: string|Function, delay?: number, ...args: any[]): number {
    const tid = ++nextTimeoutID;
    timeoutMap.set(tid, {
        handler:   mkHandler(arg0, ...args),
        startedAt: Date.now(),
        delay:     delay || 0,
        repeat:    true
    });
    listenOnTicks();
    return tid;
}

/** A low-level implementation of the standard clearTimeout() function.
 */
export function clearTimeout(tid: number): void {
    timeoutMap.delete(tid);
    if (timeoutMap.size == 0) {
        unlistenOnTicks();
    }
}

/** A low-level implementation of the standard clearInterval() function.
 */
export function clearInterval(tid: number): void {
    clearTimeout(tid);
}
