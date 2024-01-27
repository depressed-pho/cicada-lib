import * as I from "../inspect.js";
import * as PP from "../pprint.js";
import * as MC from "@minecraft/server";

export type BlockStateValue = boolean|number|string;

/** A read-only Map type that represents block permutation states. */
export class BlockStates implements Iterable<[string, BlockStateValue]>, I.HasCustomInspection {
    readonly #perm: MC.BlockPermutation;

    public constructor(rawPerm: MC.BlockPermutation) {
        this.#perm = rawPerm;
    }

    public get size(): number {
        return Object.keys(this.#perm.getAllStates()).length;
    }

    public [Symbol.iterator](): IterableIterator<[string, BlockStateValue]> {
        return this.entries();
    }

    public *entries(): IterableIterator<[string, BlockStateValue]> {
        yield* Object.entries(this.#perm.getAllStates());
    }

    public forEach(f: (value: BlockStateValue, key: string, map: BlockStates) => void, thisArg?: any): void {
        const boundF = f.bind(thisArg);
        for (const [key, value] of this) {
            boundF(value, key, this);
        }
    }

    public get(key: string): BlockStateValue|undefined {
        return this.#perm.getState(key);
    }

    public has(key: string): boolean {
        return this.get(key) !== undefined;
    }

    public *keys(): IterableIterator<string> {
        yield* Object.keys(this.#perm.getAllStates());
    }

    public *values(): IterableIterator<BlockStateValue> {
        yield* Object.values(this.#perm.getAllStates());
    }

    /// @internal
    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc): PP.Doc {
        const obj = new Map(this);
        Object.defineProperty(obj, Symbol.toStringTag, {value: "BlockStates"});
        return inspect(obj);
    }
}
