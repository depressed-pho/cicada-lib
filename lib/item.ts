import { ItemLockMode, ItemStack } from "./item/stack.js";
import { Player } from "./player.js";
import { Wrapper } from "./wrapper.js";
import * as MC from "@minecraft/server";

export { ItemLockMode, ItemStack };
export { ItemBag } from "./item/bag.js";
export { ItemDurability } from "./item/durability.js";
export { EnchantmentType, ItemEnchantments } from "./item/enchantments.js";
export { ItemTags } from "./item/tags.js";
export { ItemType } from "./item/type.js";

export interface ItemUseAfterEvent {
    readonly itemStack: ItemStack;
    readonly source: Player;
}

export class ItemUseBeforeEvent extends Wrapper<MC.ItemUseBeforeEvent> implements ItemUseAfterEvent {
    public cancel() {
        this.raw.cancel = true;
    }

    public get itemStack(): ItemStack {
        return new ItemStack(this.raw.itemStack);
    }

    public get source(): Player {
        return new Player(this.raw.source);
    }
}
