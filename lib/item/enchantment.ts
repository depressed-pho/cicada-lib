import { Wrapper } from "../wrapper.js";
import { EnchantmentType } from "@minecraft/server";
import * as MC from "@minecraft/server";

export { EnchantmentType };

export class ItemEnchantments extends Wrapper<MC.ItemEnchantableComponent|undefined> implements Set<Enchantment> {
    public get size(): number {
        return this.raw ? this.raw.getEnchantments().length : 0;
    }

    public get [Symbol.toStringTag](): string {
        return "ItemEnchantments";
    }

    public [Symbol.iterator](): IterableIterator<Enchantment> {
        return this.values();
    }

    public add(ench: Enchantment): this {
        if (this.raw) {
            this.raw.addEnchantment(ench);
            return this;
        }
        else {
            throw new TypeError("this item can have no enchantments");
        }
    }

    public canAdd(ench: Enchantment): boolean {
        return this.raw
            ? this.raw.canAddEnchantment(ench)
            : false;
    }

    public clear(): void {
        if (this.raw) {
            this.raw.removeAllEnchantments();
        }
    }

    public delete(ench: Enchantment|EnchantmentType|string): boolean {
        if (this.has(ench)) {
            if (ench instanceof Enchantment) {
                this.raw!.removeEnchantment(ench.type);
            }
            else {
                this.raw!.removeEnchantment(ench);
            }
            return true;
        }
        else {
            return false;
        }
    }

    public *entries(): IterableIterator<[Enchantment, Enchantment]> {
        for (const ench of this) {
            yield [ench, ench];
        }
    }

    public forEach(f: (value: Enchantment, value2: Enchantment, set: Set<Enchantment>) => void, thisArg?: any): void {
        const boundF = f.bind(thisArg);
        for (const ench of this) {
            boundF(ench, ench, this);
        }
    }

    public get(type: EnchantmentType|string): Enchantment|undefined {
        if (this.raw) {
            // FIXME: Remove this glue code when the API is updated to 1.9.0.
            if ("enchantments" in this.raw) {
                // @ts-ignore
                const raw = this.raw.enchantments.getEnchantment(type);
                return raw ? new Enchantment(raw) : undefined;
            }

            const raw = this.raw.getEnchantment(type);
            return raw ? new Enchantment(raw) : undefined;
        }
        else {
            return undefined;
        }
    }

    public has(ench: Enchantment|EnchantmentType|string): boolean {
        if (this.raw) {
            if (ench instanceof Enchantment) {
                const existing = this.get(ench.type);
                return existing
                    ? existing.level == ench.level
                    : false;
            }
            else {
                // FIXME: Remove this glue code when the API is updated to 1.9.0.
                if ("enchantments" in this.raw) {
                    // @ts-ignore
                    return this.raw.enchantments.hasEnchantment(ench);
                }

                return this.raw.hasEnchantment(ench);
            }
        }
        else {
            return false;
        }
    }

    public keys(): IterableIterator<Enchantment> {
        return this.values();
    }

    public *values(): IterableIterator<Enchantment> {
        if (this.raw) {
            for (const raw of this.raw.getEnchantments()) {
                yield new Enchantment(raw);
            }
        }
    }
}

export class Enchantment implements MC.Enchantment {
    #type: EnchantmentType;
    #level: number;

    /** Package private: user code should not use this. */
    public constructor(rawEnchantment: MC.Enchantment);

    /** Construct an enchantment. */
    public constructor(type: EnchantmentType|string, level: number);

    public constructor(...args: any[]) {
        if (args[0] instanceof EnchantmentType) {
            this.#type  = args[0];
            this.#level = args[1];
        }
        else if (typeof args[0] === "string") {
            const type = MC.EnchantmentTypes.get(args[0]);
            if (type) {
                this.#type  = type;
                this.#level = args[1];
            }
            else {
                throw new Error(`Non-existent enchantment type: ${args[0]}`);
            }
        }
        else {
            if (typeof args[0].type === "string") {
                const type = MC.EnchantmentTypes.get(args[0].type);
                if (type) {
                    this.#type  = type;
                    this.#level = args[0].level;
                }
                else {
                    throw new Error(`Non-existent enchantment type: ${args[0].type}`);
                }
            }
            else {
                this.#type  = args[0].type;
                this.#level = args[0].level;
            }
        }
    }

    get type(): EnchantmentType {
        return this.#type;
    }

    get level(): number {
        return this.#level;
    }
}
