import { ConsoleBase, Severity } from "../console-base.js";
import { Player } from "../player.js";

export class PlayerConsole extends ConsoleBase {
    readonly #player: Player;

    /** Package private */
    public constructor(player: Player) {
        super();
        this.#player = player;
    }

    protected logImpl(sev: Severity, ...args: any[]): void {
        if (sev >= this.logLevel) {
            const msg = [
                this.severityToString(sev),
                this.timestamp(),
                ":",
                this.indent(),
                this.format(...args)
            ].join(""); // THINKME: Should we really join it?

            this.#player.sendMessage(msg);
        }

        // Also send it to the standard console.
        switch (sev) {
            case Severity.Debug:
                console.debug(...args);
                break;
            case Severity.Info:
                console.info(...args);
                break;
            case Severity.Log:
                console.log(...args);
                break;
            case Severity.Warning:
                console.warn(...args);
                break;
            case Severity.Error:
                console.error(...args);
                break;
        }
    }
}
