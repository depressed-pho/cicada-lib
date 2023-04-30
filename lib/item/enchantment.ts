import * as MC from "@minecraft/server";

export class ItemEnchants {
    readonly #itemEnchants: MC.ItemEnchantsComponent;

    /** The constructor is public only because of a language
     * limitation. User code must never call it directly. */
    public constructor(rawItemEnchants: MC.ItemEnchantsComponent) {
       this.#itemEnchants = rawItemEnchants;
    }

    /** Package private: user code should not use this. */
    get raw(): MC.ItemEnchantsComponent {
        return this.#itemEnchants;
    }

    /* FIXME: This doesn't work: "Failed to set property 'enchantments'" */
    public setSlot(slot: number|string): this {
        const list = new EnchantmentList(slot);
        this.#itemEnchants.enchantments = list.raw;
        return this;
    }

    public add(ench: Enchantment): this {
        const list = new EnchantmentList(this.#itemEnchants.enchantments);
        list.add(ench);
        return this;
    }
}

export class EnchantmentList {
    readonly #enchantmentList: MC.EnchantmentList;

    /** This overload is public only because of a language limitation. User
     * code must never call it directly. */
    public constructor(rawEnchantmentList: MC.EnchantmentList);
    /** Construct a list of enchantment with a given enchantment slot. */
    public constructor(slot: number|string);
    public constructor(arg0: MC.EnchantmentList|number|string) {
        if (arg0 instanceof MC.EnchantmentList) {
            this.#enchantmentList = arg0;
        }
        else if (typeof arg0 === "number") {
            this.#enchantmentList = new MC.EnchantmentList(arg0);
        }
        else {
            const slot = (() => {
                if ((MC.EnchantmentSlot as any)[arg0] != null) {
                    return (MC.EnchantmentSlot as any)[arg0];
                }
                else {
                    throw Error(`Unknown enchantment slot: ${arg0}`);
                }
            })();
            this.#enchantmentList = new MC.EnchantmentList(slot);
        }
    }

    /** Package private: user code should not use this. */
    get raw(): MC.EnchantmentList {
        return this.#enchantmentList;
    }

    public add(ench: Enchantment): this {
        if (this.#enchantmentList.canAddEnchantment(ench.raw)) {
            this.#enchantmentList.addEnchantment(ench.raw);
        }
        else {
            throw Error(`Incompatible enchantment for this item stack: ${ench.type.id}`);
        }
        return this;
    }
}

export class Enchantment {
    readonly #enchantment: MC.Enchantment;

    /** This overload is public only because of a language limitation. User
     * code must never call it directly. */
    public constructor(rawEnchantment: MC.Enchantment);
    /** Construct an enchantment. */
    public constructor(enchType: MC.EnchantmentType|string, level?: number);
    public constructor(arg0: MC.Enchantment|MC.EnchantmentType|string, ...rest: any[]) {
        if (arg0 instanceof MC.Enchantment) {
            this.#enchantment = arg0;
        }
        else if (arg0 instanceof MC.EnchantmentType) {
            this.#enchantment = new MC.Enchantment(arg0, ...rest);
        }
        else {
            /* Fucking shit. The API doesn't provides a functionality for this. */
            const ty = (() => {
                let id = arg0;
                if (id.startsWith("minecraft:")) {
                    id = id.replace("minecraft:", "");
                }
                id = id.replaceAll(
                    /_(.)/g,
                    (_, c) => c.toUpperCase());

                if ((MC.MinecraftEnchantmentTypes as any)[id] != null) {
                    return (MC.MinecraftEnchantmentTypes as any)[id];
                }
                else {
                    throw Error(`Unknown enchantment ID: ${arg0}`);
                }
            })();
            this.#enchantment = new MC.Enchantment(ty, ...rest);
        }
    }

    /** Package private: user code should not use this. */
    get raw(): MC.Enchantment {
        return this.#enchantment;
    }

    get type(): MC.EnchantmentType {
        return this.#enchantment.type;
    }
}
