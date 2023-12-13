import * as MC from "@minecraft/server";

/** A read-only set of item tags. It is mostly compatible with the Set
 * interface but any mutations will throw a `TypeError`.
 */
export class ItemTags implements Set<string> {
    readonly #stack: MC.ItemStack;

    /// Package private.
    public constructor(rawStack: MC.ItemStack) {
        this.#stack = rawStack;
    }

    public get size(): number {
        return this.#stack.getTags().length;
    }

    public get [Symbol.toStringTag](): string {
        return "ItemTags";
    }

    public [Symbol.iterator](): IterableIterator<string> {
        return this.values();
    }

    public add(_tag: string): this {
        throw new TypeError(`ItemTags are read-only`);
    }

    public clear(): void {
        throw new TypeError(`ItemTags are read-only`);
    }

    public delete(_tag: string): boolean {
        throw new TypeError(`ItemTags are read-only`);
    }

    public *entries(): IterableIterator<[string, string]> {
        for (const tag of this) {
            yield [tag, tag];
        }
    }

    public forEach(f: (value: string, value2: string, set: Set<string>) => void, thisArg?: any): void {
        const boundF = f.bind(thisArg);
        for (const tag of this) {
            boundF(tag, tag, this);
        }
    }

    public has(tag: string): boolean {
        return this.#stack.hasTag(tag);
    }

    public keys(): IterableIterator<string> {
        return this.values();
    }

    public values(): IterableIterator<string> {
        return this.#stack.getTags()[Symbol.iterator]();
    }
}
