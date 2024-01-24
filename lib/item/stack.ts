import { BlockStateValue } from "../block.js";
import { Wrapper } from "../wrapper.js";
import { type InspectOptions, type HasCustomInspection, customInspectSymbol } from "../inspect.js";
import { ItemDurability } from "./durability.js";
import { ItemEnchantments } from "./enchantments.js";
import { ItemTags } from "./tags.js";
import { ItemType } from "./type.js";
import { ItemLockMode } from "@minecraft/server";
import * as PP from "../pprint.js";
import * as MC from "@minecraft/server";

export { ItemLockMode };

export class ItemStack extends Wrapper<MC.ItemStack> implements HasCustomInspection {
    #tags?: ItemTags;
    #type?: ItemType;
    #durability?: ItemDurability|null;
    #enchantments?: ItemEnchantments;

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

    public get isStackable(): boolean {
        return this.raw.isStackable;
    }

    public get keepOnDeath(): boolean {
        return this.raw.keepOnDeath;
    }
    public set keepOnDeath(b: boolean) {
        this.raw.keepOnDeath = b;
    }

    public get lockMode(): ItemLockMode {
        return this.raw.lockMode;
    }
    public set lockMode(mode: ItemLockMode) {
        this.raw.lockMode = mode;
    }

    public get nameTag(): string|undefined {
        return this.raw.nameTag;
    }
    public set nameTag(name: string|undefined) {
        if (name === undefined)
            delete this.raw.nameTag;
        else
            this.raw.nameTag = name;
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

    public [customInspectSymbol](inspect: (value: any, opts?: InspectOptions) => PP.Doc): PP.Doc {
        const obj: any = {
            typeId: this.typeId
        };
        if (this.isStackable) {
            obj.amount    = this.amount;
            obj.maxAmount = this.maxAmount;
        }
        if (this.keepOnDeath) obj.keepOnDeath = true;
        if (this.lockMode !== ItemLockMode.none) obj.lockMode = this.lockMode;
        if (this.lore.length > 0) obj.lore = this.lore;
        if (this.tags.size > 0) obj.tags = this.tags;

        const comps: any = {};
        if (this.durability) comps.durability = this.durability;
        if (this.enchantments.size > 0) comps.enchantments = this.enchantments;
        for (const comp of this.raw.getComponents()) {
            switch (comp.typeId) {
                case "minecraft:durability":
                case "minecraft:enchantments": // FIXME: Remove this in the future
                case "minecraft:enchantable":
                    // These are already inspected in our own way.
                    break;
                default:
                    comps[comp.typeId] = comp;
            }
        }
        if (Object.entries(comps).length > 0) obj.components = comps;

        return PP.spaceCat(PP.text("ItemStack"), inspect(obj, {showHidden: true}));
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
        if (this.#durability === undefined) {
            const raw = this.raw.getComponent("minecraft:durability");
            this.#durability = raw ? new ItemDurability(raw, this.enchantments) : null;
        }
        return this.#durability ? this.#durability : undefined;
    }

    /** Obtain the set of enchantments applied to this item stack. This
     * function returns an empty set of enchantments if the item cannot be
     * enchanted.
     */
    public get enchantments(): ItemEnchantments {
        if (!this.#enchantments) {
            // FIXME: Remove this glue code when the API is updated to 1.9.0.
            if (1) {
                // @ts-ignore
                const comp = this.raw.getComponent("minecraft:enchantments");
                if (comp)
                    this.#enchantments = new ItemEnchantments(comp as any);
                else
                    this.#enchantments = new ItemEnchantments(
                        this.raw.getComponent("minecraft:enchantable"));
            }
            else {
                this.#enchantments = new ItemEnchantments(
                    this.raw.getComponent("minecraft:enchantable"));
            }
        }
        return this.#enchantments;
    }
}
