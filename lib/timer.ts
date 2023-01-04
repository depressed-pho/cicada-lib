export class Timer {
    public readonly startedAt: number;

    public constructor() {
        this.startedAt = Date.now();
    }

    public get elapsed(): number {
        return Date.now() - this.startedAt;
    }

    public toString(): string {
        let ms = this.elapsed;
        if (ms < 1000) {
            return `${ms}ms`;
        }
        else {
            const d = Math.floor(ms / 1000 / 60 / 60 / 24);
            ms %= 1000 * 60 * 60 * 24;

            const h = Math.floor(ms / 1000 / 60 / 60);
            ms %= 1000 * 60 * 60;

            const m = Math.floor(ms / 1000 / 60);
            ms %= 1000 * 60;

            const s = (ms / 1000).toFixed(3);

            return d > 0 ? `${d}d ${h}h ${m}m ${s}s`
                 : h > 0 ? `${h}h ${m}m ${s}s`
                 : m > 0 ? `${m}m ${s}s`
                 :         `${s}s`;
        }
    }
}
