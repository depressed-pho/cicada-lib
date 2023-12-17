import { Wrapper } from "../wrapper.js";
import { ItemEnchantments } from "./enchantment.js";
import { ItemTags } from "./tags.js";
import * as MC from "@minecraft/server";

export class ItemStack extends Wrapper<MC.ItemStack> {
    #tags?: ItemTags;

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

    /** Returns the set of tags for this item stack. */
    get tags(): ItemTags {
        if (!this.#tags)
            this.#tags = new ItemTags(this.raw);

        return this.#tags;
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

    get maxAmount(): number {
        return this.raw.maxAmount;
    }

    get enchantments(): ItemEnchantments {
        // FIXME: Remove this glue code when the API is updated.
        if (1) {
            // @ts-ignore
            const comp = this.raw.getComponent("minecraft:enchantments");
            if (comp)
                return new ItemEnchantments(comp as any);
        }

        return new ItemEnchantments(
            this.raw.getComponent("minecraft:enchantable"));
    }

    public clone(): ItemStack {
        return new ItemStack(this.raw.clone());
    }

    /** Return whether this item stack can be stacked with the given
     * `itemStack`. The amount of each item stack is not taken into
     * consideration.
     */
    public isStackableWith(stack: ItemStack): boolean {
        return this.raw.isStackableWith(stack.raw);
    }
}
