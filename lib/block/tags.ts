import * as MC from "@minecraft/server";

/** A read-only set of block permutation tags. It is mostly compatible with the Set
 * interface but no mutations can be performed.
 */
export class BlockTags implements Iterable<string> {
    readonly #perm: MC.BlockPermutation;

    /// Package private.
    public constructor(rawPerm: MC.BlockPermutation) {
        this.#perm = rawPerm;
    }

    public get size(): number {
        return this.#perm.getTags().length;
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
        return this.#perm.hasTag(tag);
    }

    public keys(): IterableIterator<string> {
        return this.values();
    }

    public values(): IterableIterator<string> {
        return this.#perm.getTags()[Symbol.iterator]();
    }
}
