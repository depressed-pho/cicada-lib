import { BlockStateValue } from "../block.js";
import { Wrapper } from "../wrapper.js";
import { ItemDurability } from "./durability.js";
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

    public get amount(): number {
        return this.raw.amount;
    }
    public set amount(n: number) {
        this.raw.amount = n;
    }

    /** Returns the set of tags for this item stack. */
    public get tags(): ItemTags {
        if (!this.#tags)
            this.#tags = new ItemTags(this.raw);

        return this.#tags;
    }

    public get type(): ItemType {
        if (!this.#type)
            this.#type = new ItemType(this.raw.type);

        return this.#type;
    }

    public get typeId(): string {
        return this.raw.typeId;
    }

    public get lore(): string[] {
        return this.raw.getLore();
    }
    public set lore(lore: string[]) {
        this.raw.setLore(lore);
    }

    public get maxAmount(): number {
        return this.raw.maxAmount;
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

    // ---------- Components ----------

    /** Obtain durability of this item stack, or `undefined` if it doesn't
     * take damage.
     */
    public get durability(): ItemDurability|undefined {
        const raw = this.raw.getComponent("minecraft:durability");
        return raw ? new ItemDurability(raw, this.enchantments) : undefined;
    }

    /** Obtain the set of enchantments applied to this item stack. This
     * function returns an empty set of enchantments if the item cannot be
     * enchanted.
     */
    public get enchantments(): ItemEnchantments {
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

    /// @internal
    public reference(onMutate: () => void): ItemStack {
        return new ItemStackRef(this, onMutate);
    }
}

class ItemStackRef extends ItemStack {
    readonly #onMutate: () => void;

    public constructor(stack: ItemStack, onMutate: () => void) {
        super(stack.raw);
        this.#onMutate = onMutate;
    }

    public override set amount(n: number) {
        super.amount = n;
        this.#onMutate();
    }

    public override set lore(lore: string[]) {
        super.lore = lore;
        this.#onMutate();
    }

    public override get durability(): ItemDurability|undefined {
        const dur = super.durability;
        return dur ? dur.reference(this.#onMutate) : undefined;
    }

    public override get enchantments(): ItemEnchantments {
        return super.enchantments.reference(this.#onMutate);
    }
}
