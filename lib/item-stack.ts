import { ItemEnchants } from "./enchantment.js";
import * as MC from "@minecraft/server";

export class ItemStack {
    readonly #itemStack: MC.ItemStack;

    /** This overload is public only because of a language limitation. User
     * code must never call it directly. */
    public constructor(rawItemStack: MC.ItemStack);
    /** Construct an item stack. */
    public constructor(itemType: MC.ItemType|string, amount?: number, data?: number);
    public constructor(arg0: MC.ItemStack|MC.ItemType|string, ...rest: any[]) {
        if (arg0 instanceof MC.ItemStack) {
            this.#itemStack = arg0;
        }
        else if (arg0 instanceof MC.ItemType) {
            this.#itemStack = new MC.ItemStack(arg0, ...rest);
        }
        else {
            const ty = MC.Items.get(arg0);
            if (!ty) {
                throw Error(`Unknown item ID: ${arg0}`);
            }
            this.#itemStack = new MC.ItemStack(ty, ...rest);
        }
    }

    /** Package private: user code should not use this. */
    get raw(): MC.ItemStack {
        return this.#itemStack;
    }

    get amount(): number {
        return this.#itemStack.amount;
    }
    set amount(n: number) {
        this.#itemStack.amount = n;
    }

    get data(): number {
        return this.#itemStack.data;
    }
    set data(n: number) {
        this.#itemStack.data = n;
    }

    get typeId(): string {
        return this.#itemStack.typeId;
    }

    get lore(): string[] {
        return this.#itemStack.getLore();
    }
    set lore(lore: string[]) {
        this.#itemStack.setLore(lore);
    }

    get enchantments(): ItemEnchants {
        return new ItemEnchants(
            this.#itemStack.getComponent("minecraft:enchantments") as MC.ItemEnchantsComponent);
    }
}
