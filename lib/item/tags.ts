import * as I from "../inspect.js";
import * as PP from "../pprint.js";

export interface ObjectWithItemTags {
    getTags(): string[];
    hasTag(tag: string): boolean;
}

/** A read-only set of item tags. It is mostly compatible with the Set
 * interface but no mutations can be performed.
 */
export class ItemTags implements Iterable<string>, I.HasCustomInspection {
    readonly #target: ObjectWithItemTags;

    // @internal
    public constructor(target: ObjectWithItemTags) {
        this.#target = target;
    }

    public get size(): number {
        return this.#target.getTags().length;
    }

    public get [Symbol.toStringTag](): string {
        return "ItemTags";
    }

    public [Symbol.iterator](): IterableIterator<string> {
        return this.values();
    }

    public *entries(): IterableIterator<[string, string]> {
        for (const tag of this) {
            yield [tag, tag];
        }
    }

    public forEach(f: (value: string, value2: string, set: ItemTags) => void, thisArg?: any): void {
        const boundF = f.bind(thisArg);
        for (const tag of this) {
            boundF(tag, tag, this);
        }
    }

    public has(tag: string): boolean {
        return this.#target.hasTag(tag);
    }

    public keys(): IterableIterator<string> {
        return this.values();
    }

    public values(): IterableIterator<string> {
        return this.#target.getTags()[Symbol.iterator]();
    }

    /// @internal
    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc): PP.Doc {
        const obj = new Set(this);
        Object.defineProperty(obj, Symbol.toStringTag, {value: "ItemTags"});
        return inspect(obj);
    }
}
