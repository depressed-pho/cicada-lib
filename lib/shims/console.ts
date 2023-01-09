/** The Bedrock API has a global "console" object, which redirects messages
 * to the content log. However, its functionality is very limited at the
 * moment, such as not displaying stack traces of Error objects. This
 * module provides an alternative "console" object that works better. We
 * hope it will eventually go away.
 */
import { ConsoleBase, Severity } from "../console-base.js";
import { installGlobal } from "./_util.js";

class BedrockConsole extends ConsoleBase {
    #origConsole: Console;

    /// Do not use this directly.
    constructor(origConsole: Console) {
        super();
        this.#origConsole = origConsole;
    }

    protected logImpl(sev: Severity, ...args: any[]): void {
        if (sev >= this.logLevel) {
            const msg = [
                this.severityToString(sev),
                this.timestamp(),
                ":",
                this.indent(),
                this.format(...args)
            ].join("");

            if (sev === Severity.Error) {
                this.#origConsole.error(msg);
            }
            else {
                this.#origConsole.warn(msg);
            }
        }
    }
}

installGlobal("console", new BedrockConsole(globalThis.console), {overwrite: true});
