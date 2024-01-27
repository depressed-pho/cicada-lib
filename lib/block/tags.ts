import * as I from "../inspect.js";
import * as PP from "../pprint.js";
import * as MC from "@minecraft/server";

/** A read-only set of block permutation tags. It is mostly compatible with the Set
 * interface but no mutations can be performed.
 */
export class BlockTags implements Iterable<string>, I.HasCustomInspection {
    readonly #source: MC.Block|MC.BlockPermutation;

    /// Package private.
    public constructor(source: MC.Block|MC.BlockPermutation) {
        this.#source = source;
    }

    public get size(): number {
        return this.#source.getTags().length;
    }

    public get [Symbol.toStringTag](): string {
        return "BlockTags";
    }

    public [Symbol.iterator](): IterableIterator<string> {
        return this.values();
    }

    public *entries(): IterableIterator<[string, string]> {
        for (const tag of this) {
            yield [tag, tag];
        }
    }

    public forEach(f: (value: string, value2: string, set: BlockTags) => void, thisArg?: any): void {
        const boundF = f.bind(thisArg);
        for (const tag of this) {
            boundF(tag, tag, this);
        }
    }

    public has(tag: string): boolean {
        return this.#source.hasTag(tag);
    }

    public keys(): IterableIterator<string> {
        return this.values();
    }

    public values(): IterableIterator<string> {
        return this.#source.getTags()[Symbol.iterator]();
    }

    /// @internal
    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc): PP.Doc {
        const obj = new Set(this);
        Object.defineProperty(obj, Symbol.toStringTag, {value: "BlockTags"});
        return inspect(obj);
    }
}
