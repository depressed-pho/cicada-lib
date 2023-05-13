/** Unicode-aware strings: unlike the standard String type, this one treats
 * strings as an array of Unicode code points, not UTF-8 code units.
 */
export class UniString {
    #_str?: string;
    #_cps?: Uint32Array;

    /// Wrap a standard string in UniString.
    public constructor(str: string);

    /// Construct a unicode string with an array of code points.
    public constructor(cps: number[]|Uint32Array);

    public constructor(arg: any) {
        if (typeof arg === "string") {
            this.#_str  = arg;
        }
        else {
            this.#_cps = Array.isArray(arg) ? new Uint32Array(arg) : arg;
        }
    }

    /// Empty UniString.
    public static readonly empty = new UniString("");

    get #str(): string {
        if (this.#_str === undefined) {
            this.#_str = String.fromCodePoint(...this.#_cps!);
        }
        return this.#_str;
    }

    get #cps(): Uint32Array {
        if (!this.#_cps) {
            this.#_cps = new Uint32Array(Array.from(this.#_str!).map(c => c.codePointAt(0)!));
        }
        return this.#_cps;
    }

    public get length(): number {
        return this.#cps.length;
    }

    public *[Symbol.iterator](): IterableIterator<string> {
        for (const cp of this.#cps) {
            yield String.fromCodePoint(cp);
        }
    }

    public at(idx: number): string|undefined {
        const cp = this.#cps[idx];
        return cp === undefined ? undefined : String.fromCodePoint(cp);
    }

    public concat(...strs: UniString[]): UniString {
        let len = this.length;
        for (const str of strs) {
            len += str.length;
        }

        const cps = new Uint32Array(len);
        let   pos = this.length;
        cps.set(this.#cps);
        for (const str of strs) {
            cps.set(str.#cps, pos);
            pos += str.length;
        }

        return new UniString(cps);
    }

    public equals(str: UniString): boolean {
        return this.#str === str.#str;
    }

    public substring(start: number, end?: number): UniString {
        return new UniString(this.#cps.subarray(start, end));
    }

    public valueOf(): string {
        return this.#str;
    }
}
