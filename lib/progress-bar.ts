export interface ProgressBarOptions {
    width?: number,
    decayP?: number, // Ignored when showETA is false.
    /** Put a linebreak between the bar and text. */
    linebreak?: boolean,
    showPercent?: boolean,
    showETA?: boolean
}

const defaultOpts: Required<ProgressBarOptions> = {
    width:       20,
    decayP:      0.1,
    linebreak:   true,
    showPercent: true,
    showETA:     true
}

/** A text-based progress bar, intended to be displayed as an action bar
 * text. We use the algorithm described in
 * https://stackoverflow.com/a/42009090
 */
export class ProgressBar {
    #opts: Required<ProgressBarOptions>;

    #lastUpdated: number;
    #total: number;
    #weight: number;

    #done: number;
    #slownessEst: number|null;

    constructor(total: number, opts: ProgressBarOptions = {}) {
        this.#opts = {...defaultOpts, ...opts};

        this.#lastUpdated = Date.now();
        this.#total       = total;

        this.#done        = 0;
        this.#slownessEst = null;

        if (this.#opts.width <= 0) {
            throw new RangeError(`width must be positive: ${this.#opts.width}`);
        }
        if (this.#opts.decayP <= 0) {
            throw new RangeError(
                `decayP must be positive and should not be greater than 1: ${this.#opts.decayP}`);
        }
        if (this.#total <= 0) {
            throw new RangeError(`total must be positive: ${this.#total}`);
        }

        // Weight is a function of total and decayP. Computing it would
        // probably not be cheap so we cache it.
        this.#weight = Math.exp(-1 / (this.#total * this.#opts.decayP));
    }

    public get width(): number {
        return this.#opts.width;
    }
    public set width(newWidth: number) {
        // Dunno who would like to change this but we allow it
        // nevertheless.
        if (newWidth <= 0) {
            throw new RangeError(`width must be positive: ${newWidth}`);
        }
        else {
            this.#opts.width = newWidth;
        }
    }

    public get decayP(): number {
        return this.#opts.decayP;
    }
    public set decayP(newDecayP: number) {
        // Dunno who would like to change this but we allow it
        // nevertheless.
        if (newDecayP <= 0) {
            throw new RangeError(`decayP must be positive: ${newDecayP}`);
        }
        else {
            this.#opts.decayP = newDecayP;
            this.#weight      = Math.exp(-1 / (this.#total * this.#opts.decayP));
        }
    }

    public get total(): number {
        return this.#total;
    }
    /* It's okay to change the total amount of work in the middle of
     * process. We just need to scale the estimation of slowness. */
    public set total(newTotal: number) {
        if (newTotal <= 0) {
            throw new RangeError(`total must be positive: ${newTotal}`);
        }
        else {
            if (this.#slownessEst != null) {
                this.#slownessEst *= newTotal / this.#total;
            }
            this.#total  = newTotal;
            this.#weight = Math.exp(-1 / (this.#total * this.#opts.decayP));
        }
    }

    public get done(): number {
        return this.#done;
    }
    public set done(newDone: number) {
        if (newDone < this.#done) {
            throw new RangeError(`"done" must be monotonically increasing: ${this.#done} → ${newDone}`);
        }
        else if (newDone == this.#done) {
            // This is essentially an error too, but we tolerate it. No-op.
        }
        else if (newDone > this.#total) {
            throw new RangeError(`"done" must not be greater than the total: ${newDone} > ${this.#total}`);
        }
        else {
            const now      = Date.now();
            const slowness = this.#total * (now - this.#lastUpdated);
            if (slowness < 0) {
                // A leap second or something? Ignore it anyway.
            }
            else {
                if (this.#slownessEst == null) {
                    this.#slownessEst = slowness;
                }
                else {
                    this.#slownessEst
                        = this.#slownessEst * this.#weight
                        + slowness * (1.0 - this.#weight);
                }
            }
            this.#done        = newDone;
            this.#lastUpdated = now;
        }
    }

    /** Stringify the progress bar. */
    public toString(): string {
        let str = this.#formatBar();

        if (this.#opts.showPercent || this.#opts.showETA) {
            str += this.#opts.linebreak ? "\n" : " ";

            if (this.#opts.showPercent) {
                str += this.#formatPercentage();
            }

            if (this.#opts.showETA) {
                const eta = this.#formatETA();
                if (eta != null) {
                    if (this.#opts.showPercent) {
                        str += " ";
                    }
                    str += `(ETA: ${eta})`;
                }
            }
        }

        return str;
    }

    #formatBar(): string {
        const prog = this.#done / this.#total;
        let bar = "";
        for (let i = 0; i < this.#opts.width; i++) {
            bar += i / this.#opts.width <= prog ? '█' : '▒';
        }
        return bar;
    }

    #formatPercentage(): string {
        const pct = (this.#done / this.#total) * 100;
        return pct.toFixed(0) + "%";
    }

    #formatETA(): string|null {
        if (this.#slownessEst == null) {
            // We have no data to estimate the remaining time.
            return null;
        }
        else {
            let ms = (1.0 - this.#done / this.#total) * this.#slownessEst;

            const d = Math.floor(ms / 1000 / 60 / 60 / 24);
            ms %= 1000 * 60 * 60 * 24;

            const h = Math.floor(ms / 1000 / 60 / 60);
            ms %= 1000 * 60 * 60;

            const m = Math.floor(ms / 1000 / 60);
            ms %= 1000 * 60;

            const s = (ms / 1000).toFixed(1);

            return d > 0 ? `${d}d ${h}h ${m}m ${s}s`
                 : h > 0 ? `${h}h ${m}m ${s}s`
                 : m > 0 ? `${m}m ${s}s`
                 :         `${s}s`;
        }
    }
}
