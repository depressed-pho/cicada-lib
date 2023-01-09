import { formatWithOptions, stringify } from "./format.js";
import { InspectOptions, inspect } from "./inspect.js";
import { Timer } from "./timer.js";
import * as PP from "./pprint.js";

export enum Severity {
    Debug,
    Info,
    Log,
    Warning,
    Error
}

/** Console API for non-interactive wall of text. Intended only for
 * internal use. */
export abstract class ConsoleBase implements Console {
    /** A non-standard property that controls the threshold of severity.
     */
    public logLevel: Severity = Severity.Debug;

    /** A non-standard property for indenting log groups and pretty-printed
     * objects. */
    public indentationWidth: number = 4;

    /** A non-standard property for choosing whether to color the output.
     */
    public colors: boolean = true;

    // Used for console.count().
    #counts = new Map<string, number>();

    // Used for console.group().
    #currentGroupDepth: number = 0;

    // Used for console.time().
    #timers = new Map<string, Timer>();

    protected abstract logImpl(sev: Severity, ...args: any[]): void;

    get #inspectOpts(): InspectOptions {
        return {
            indentationWidth: this.indentationWidth,
            colors:           this.colors
        };
    }

    public assert(assertion: boolean, ...args: any[]): void {
        if (!assertion) {
            /* We think it's better to show a stacktrace, not just a
             * message. */
            this.error(
                args.length > 0
                    ? new Error("Assertion failed: " + this.format(...args))
                    : new Error("Assertion failed"));
        }
    }

    public clear(): void {
        // We can't clear the log from within the API. This has to be a
        // no-op.
    }

    public count(label: string = "default"): void {
        const count = (this.#counts.get(label) || 0) + 1;

        this.debug(`${label}: ${count}`);

        this.#counts.set(label, count);
    }

    public countReset(label: string = "default"): void {
        this.#counts.delete(label);
    }

    public debug(...args: any[]): void {
        this.logImpl(Severity.Debug, ...args);
    }

    public dir(obj: any): void {
        // We can't actually make the result interactive, but at least we
        // can remove limitations and apply formatting codes.
        this.log(inspect(obj, { indentationWidth: this.indentationWidth,
                                // THINKME: showHidden makes it overflow
                                // the stack often.
                                showHidden:       false,
                                depth:            Infinity,
                                colors:           true,
                                maxArrayLength:   Infinity,
                                maxStringLength:  Infinity,
                                getters:          true }));
    }

    public dirxml(obj: any): void {
        // FIXME: What should we do about this? We don't think we have XML
        // DOM in our environment.
        this.dir(obj);
    }

    public error(...args: any[]): void {
        this.logImpl(Severity.Error, ...args);
    }

    public group(label?: string): void {
        if (label != null) {
            this.log(label);
        }
        this.#currentGroupDepth++;
    }


    public groupCollapsed(label?: string): void {
        this.group(label); // We can't collapse anything of course.
    }

    public groupEnd(): void {
        if (this.#currentGroupDepth > 0) {
            this.#currentGroupDepth--;
        }
    }

    public info(...args: any[]): void {
        this.logImpl(Severity.Info, ...args);
    }

    public log(...args: any[]): void {
        this.logImpl(Severity.Log, ...args);
    }

    public table(obj: any, _columns?: string[]): void {
        // It is way too hard to do this properly on CLI. Just redirect to
        // .log() and hope nobody will rely on this.
        this.log(obj);
    }

    public time(label: string = "default"): void {
        if (this.#timers.has(label)) {
            this.warn(`${label}: timer restarted`);
        }
        this.#timers.set(label, new Timer());
    }

    public timeLog(label: string = "default"): void {
        const timer = this.#timers.get(label);
        if (timer) {
            this.log(`${label}: ${timer}`);
        }
        else {
            this.error(`${label}: timer does not exist`);
        }
    }

    public timeEnd(label: string = "default"): void {
        const timer = this.#timers.get(label);
        if (timer) {
            this.#timers.delete(label);
            this.log(`${label}: ${timer} - timer ended`);
        }
        else {
            this.error(`${label}: timer does not exist`);
        }
    }

    public timeStamp(_label?: string): void {
        // No-op. There is no such thing as performance tool on Bedrock.
    }

    public trace(...args: any[]): void {
        const msg = args.length > 0 ? this.format(...args) : "";
        const err = new Error(msg);
        err.name = "Trace";
        this.log(err);
    }

    public warn(...args: any[]): void {
        this.logImpl(Severity.Warning, ...args);
    }

    protected indent(): string {
        return " ".repeat(this.#currentGroupDepth * this.indentationWidth);
    }

    #render(doc: PP.Doc): string {
        return PP.displayS(
            PP.renderPretty(
                1.0, Infinity,
                this.colors ? doc : PP.plain(doc)));
    }

    protected severityToString(sev: Severity): string {
        return this.#render(ConsoleBase.#severityToDoc(sev));
    }

    static #severityToDoc(sev: Severity): PP.Doc {
        switch (sev) {
            case Severity.Debug:   return PP.darkGray(PP.text("[Debug]"));
            case Severity.Info:    return PP.gray(PP.text("[Info]"));
            case Severity.Log:     return PP.bold(PP.text("[Log]"));
            case Severity.Warning: return PP.yellow(PP.text("[Warning]"));
            case Severity.Error:   return PP.bold(PP.red(PP.text("[Error]")));
            default:
                throw Error(`Unknown severity: ${sev}`);
        }
    }

    protected timestamp(): string {
        return this.#render(
            PP.gray(PP.text(`[${new Date().toLocaleTimeString()}]`)));
    }

    protected format(...args: any[]): string {
        if (args.length > 0) {
            if (typeof args[0] === "string") {
                /* The first argument being a string means that it may
                 * contain substitution specifications. */
                return formatWithOptions(this.#inspectOpts, args[0], ...(args.slice(1)));
            }
            else {
                return args.map(val => stringify(val, this.#inspectOpts)).join(" ");
            }
        }
        else {
            return "";
        }
    }
}
