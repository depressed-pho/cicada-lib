import { Wrapper } from "../wrapper.js";
import { ItemEnchants } from "./enchantment.js";
import * as MC from "@minecraft/server";

export class ItemStack extends Wrapper<MC.ItemStack> {
    /** Package private: user code should not use this. */
    public constructor(rawItemStack: MC.ItemStack);

    /** Construct an item stack. */
    public constructor(itemType: MC.ItemType|string, amount?: number);

    public constructor(arg0: MC.ItemStack|MC.ItemType|string, ...rest: any[]) {
        if (arg0 instanceof MC.ItemStack) {
            super(arg0);
        }
        else {
            super(new MC.ItemStack(arg0, ...rest));
        }
    }

    get amount(): number {
        return this.raw.amount;
    }
    set amount(n: number) {
        this.raw.amount = n;
    }

    get typeId(): string {
        return this.raw.typeId;
    }

    get lore(): string[] {
        return this.raw.getLore();
    }
    set lore(lore: string[]) {
        this.raw.setLore(lore);
    }

    get enchantments(): ItemEnchants {
        return new ItemEnchants(
            this.raw.getComponent("minecraft:enchantments") as MC.ItemEnchantsComponent);
    }
}
