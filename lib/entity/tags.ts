import * as MC from "@minecraft/server";

export class EntityTags implements Set<string> {
    readonly #entity: MC.Entity;

    public constructor(rawEntity: MC.Entity) {
        this.#entity = rawEntity;
    }

    public get size(): number {
        return this.#entity.getTags().length;
    }

    public get [Symbol.toStringTag](): string {
        return "EntityTags";
    }

    public [Symbol.iterator](): IterableIterator<string> {
        return this.values();
    }

    public add(tag: string): this {
        this.#entity.addTag(tag);
        return this;
    }

    public clear(): void {
        for (const tag of this.#entity.getTags()) {
            this.#entity.removeTag(tag);
        }
    }

    public delete(tag: string): boolean {
        return this.#entity.removeTag(tag);
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
        return this.#entity.hasTag(tag);
    }

    public keys(): IterableIterator<string> {
        return this.values();
    }

    public values(): IterableIterator<string> {
        return this.#entity.getTags()[Symbol.iterator]();
    }
}
