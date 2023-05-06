import { Wrapper } from "../wrapper.js";
import * as MC from "@minecraft/server";

export class ItemEnchants extends Wrapper<MC.ItemEnchantsComponent> {
    /* FIXME: This doesn't work: "Failed to set property 'enchantments'" */
    public setSlot(slot: number|string): this {
        const list = new EnchantmentList(slot);
        this.raw.enchantments = list.raw;
        return this;
    }

    public add(ench: Enchantment): this {
        const list = new EnchantmentList(this.raw.enchantments);
        list.add(ench);
        return this;
    }
}

export class EnchantmentList extends Wrapper<MC.EnchantmentList> {
    /** Package private: user code should not use this. */
    public constructor(rawEnchantmentList: MC.EnchantmentList);

    /** Construct a list of enchantment with a given enchantment slot. */
    public constructor(slot: number|string);

    public constructor(arg0: MC.EnchantmentList|number|string) {
        if (arg0 instanceof MC.EnchantmentList) {
            super(arg0);
        }
        else if (typeof arg0 === "number") {
            super(new MC.EnchantmentList(arg0));
        }
        else {
            super(
                (() => {
                    const slot = (() => {
                        if ((MC.EnchantmentSlot as any)[arg0] != null) {
                            return (MC.EnchantmentSlot as any)[arg0];
                        }
                        else {
                            throw Error(`Unknown enchantment slot: ${arg0}`);
                        }
                    })();
                    return new MC.EnchantmentList(slot);
                })()
            );
        }
    }

    public add(ench: Enchantment): this {
        if (this.raw.canAddEnchantment(ench.raw)) {
            this.raw.addEnchantment(ench.raw);
        }
        else {
            throw Error(`Incompatible enchantment for this item stack: ${ench.type.id}`);
        }
        return this;
    }
}

export class Enchantment extends Wrapper<MC.Enchantment> {
    /** Package private: user code should not use this. */
    public constructor(rawEnchantment: MC.Enchantment);

    /** Construct an enchantment. */
    public constructor(enchType: MC.EnchantmentType|string, level?: number);

    public constructor(arg0: MC.Enchantment|MC.EnchantmentType|string, ...rest: any[]) {
        if (arg0 instanceof MC.Enchantment) {
            super(arg0);
        }
        else if (arg0 instanceof MC.EnchantmentType) {
            super(new MC.Enchantment(arg0, ...rest));
        }
        else {
            super(
                (() => {
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
                    return new MC.Enchantment(ty, ...rest);
                })()
            );
        }
    }

    get type(): MC.EnchantmentType {
        return this.raw.type;
    }
}
