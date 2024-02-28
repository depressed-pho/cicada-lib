/** The Bedrock API lacks `setTimeout()` and its family:
 * https://developer.mozilla.org/en-US/docs/Web/API/setTimeout
 */
import { installGlobal } from "./_util.js";
import { TicksPerSecond, system } from "@minecraft/server";

function setTimeout(code: string, delay?: number): number;
function setTimeout(fun: Function, delay?: number, ...args: any[]): number;
function setTimeout(arg0: string|Function, delay?: number, ...args: any[]): number {
    const callback = mkCallback(arg0, ...args);
    if (delay != undefined) {
        const ticks = msToTicks(delay);
        return system.runTimeout(callback, ticks);
    }
    else {
        return system.run(callback);
    }
}

function setInterval(code: string, delay?: number): number;
function setInterval(fun: Function, delay?: number, ...args: any[]): number;
function setInterval(arg0: string|Function, delay?: number, ...args: any[]): number {
    const callback = mkCallback(arg0, ...args);
    if (delay != undefined) {
        const ticks = msToTicks(delay);
        return system.runInterval(callback, ticks);
    }
    else {
        return system.runInterval(callback);
    }
}

function mkCallback(arg0: string|Function, ...args: any[]): (() => unknown) {
    if (typeof arg0 === "string") {
        return () => {
            try {
                eval(arg0);
            }
            catch (e) {
                console.error(e);
            }
        };
    }
    else {
        /* The handler might actually be an async function and the returned
         * Promise might get rejected. Catch the exception if it's the
         * case. It might also be a regular function and throws.
         */
        const cb = arg0.bind(null, ...args);
        return () => {
            try {
                const ret = cb();
                Promise.resolve(ret).catch(e => console.error(e));
            }
            catch (e) {
                console.error(e);
            }
        };
    }
}

function msToTicks(ms: number): number {
    return Math.floor(ms / 1000 * TicksPerSecond);
}

installGlobal("setTimeout", setTimeout);
installGlobal("setInterval", setInterval);
installGlobal("clearTimeout", system.clearRun);
installGlobal("clearInterval", system.clearRun);
