import { BlockStateValue } from "../block.js";
import { Wrapper } from "../wrapper.js";
import { ItemEnchantments } from "./enchantment.js";
import { ItemTags } from "./tags.js";
import { ItemType } from "./type.js";
import * as MC from "@minecraft/server";

export class ItemStack extends Wrapper<MC.ItemStack> {
    #tags?: ItemTags;
    #type?: ItemType;

    /** Package private: user code should not use this. */
    public constructor(rawItemStack: MC.ItemStack);

    /** Construct an item stack. */
    public constructor(itemType: ItemType|string, amount?: number);

    /** Construct an item stack with block states. This only works for
     * items that have corresponding blocks such as `minecraft:sapling`.
     */
    public constructor(itemType: ItemType|string, states: Record<string, BlockStateValue>, amount?: number);

    public constructor(...args: any[]) {
        switch (args.length) {
            case 1:
                if (args[0] instanceof MC.ItemStack) {
                    super(args[0]);
                }
                else if (args[0] instanceof ItemType) {
                    super(new MC.ItemStack(args[0].raw));
                    this.#type = args[0];
                }
                else {
                    super(new MC.ItemStack(args[0]));
                }
                break;

            case 2:
                if (typeof args[1] === "number") {
                    if (args[0] instanceof ItemType) {
                        super(new MC.ItemStack(args[0].raw, args[1]));
                        this.#type = args[0];
                    }
                    else {
                        super(new MC.ItemStack(args[0], args[1]));
                    }
                }
                else {
                    const typeId   = args[0] instanceof ItemType ? args[0].id : args[0];
                    const rawPerm  = MC.BlockPermutation.resolve(typeId, args[1]);
                    const rawStack = rawPerm.getItemStack();
                    if (rawStack)
                        super(rawStack);
                    else
                        throw new Error("No item stack is available for the given ID and states");
                }
                break;

            case 3:
                const typeId   = args[0] instanceof ItemType ? args[0].id : args[0];
                const rawPerm  = MC.BlockPermutation.resolve(typeId, args[1]);
                const rawStack = rawPerm.getItemStack(args[2]);
                if (rawStack)
                    super(rawStack);
                else
                    throw new Error("No item stack is available for the given ID and states");
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

    get type(): ItemType {
        if (!this.#type)
            this.#type = new ItemType(this.raw.type);

        return this.#type;
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
        // FIXME: Remove this glue code when the API is updated to 1.9.0.
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
