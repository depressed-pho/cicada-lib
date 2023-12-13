import * as MC from "@minecraft/server";

export type BlockStateValue = boolean|number|string;

/** A read-only Map type that represents block permutation states. */
export class BlockStates implements Iterable<[string, BlockStateValue]> {
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
        return Object.entries(this.#perm.getAllStates());
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
        return Object.keys(this.#perm.getAllStates);
    }

    public *values(): IterableIterator<BlockStateValue> {
        return Object.values(this.#perm.getAllStates);
    }
}
