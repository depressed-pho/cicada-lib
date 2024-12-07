import { BlockStateValue } from "../block.js";
import { lazy } from "../lazy.js";
import { Wrapper } from "../wrapper.js";
import { ItemCooldown } from "./cooldown.js";
import { ItemDurability } from "./durability.js";
import { ItemEnchantments } from "./enchantments.js";
import { ItemTags } from "./tags.js";
import { ItemType } from "./type.js";
import { ItemLockMode } from "@minecraft/server";
import * as I from "../inspect.js";
import * as PP from "../pprint.js";
import * as MC from "@minecraft/server";

export { ItemLockMode };

export class ItemStack extends Wrapper<MC.ItemStack> implements I.HasCustomInspection {
    /// @internal
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
                }
                else {
                    super(new MC.ItemStack(args[0]));
                }
                break;

            case 2:
                if (typeof args[1] === "number") {
                    if (args[0] instanceof ItemType) {
                        super(new MC.ItemStack(args[0].raw, args[1]));
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

    /** The set of tags for this item stack. */
    public readonly tags: ItemTags
        = lazy(() => new ItemTags(this.raw));

    public readonly type: ItemType
        = lazy(() => new ItemType(this.raw.type));

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

    /** Cooldown effect of this item stack, or `undefined` if it's not
     * present.
     */
    public get cooldown(): ItemCooldown|undefined {
        if (this.#cooldown === undefined) {
            const raw = this.raw.getComponent(ItemCooldown.typeId);
            this.#cooldown = raw ? new ItemCooldown(raw) : null;
        }
        return this.#cooldown ?? undefined;
    }
    #cooldown?: ItemCooldown|null;

    /** Durability of this item stack, or `undefined` if it doesn't take
     * damage.
     */
    public get durability(): ItemDurability|undefined {
        if (this.#durability === undefined) {
            const raw = this.raw.getComponent(ItemDurability.typeId);
            this.#durability = raw ? new ItemDurability(raw, this.enchantments) : null;
        }
        return this.#durability ?? undefined;
    }
    #durability?: ItemDurability|null;

    /** The set of enchantments applied to this item stack. This becomes an
     * empty set of enchantments if the item cannot be enchanted.
     */
    public readonly enchantments: ItemEnchantments
        = lazy(() => {
            // FIXME: Remove this glue code when the API is updated to 1.9.0.
            if (1) {
                // @ts-ignore
                const comp = this.raw.getComponent("minecraft:enchantments");
                if (comp)
                    return new ItemEnchantments(comp as any);
                else
                    return new ItemEnchantments(
                        this.raw.getComponent(ItemEnchantments.typeId));
            }
            else {
                return new ItemEnchantments(
                    this.raw.getComponent(ItemEnchantments.typeId));
            }
        });

    /// @internal
    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                                   stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc,
                                   _opts: Required<I.InspectOptions>): PP.Doc {
        const obj: any = {
            typeId:      this.typeId,
            isStackable: this.isStackable,
        };
        if (this.isStackable) {
            obj.amount    = this.amount;
            obj.maxAmount = this.maxAmount;
        }
        if (this.keepOnDeath)
            obj.keepOnDeath = true;
        if (this.lockMode !== ItemLockMode.none)
            obj.lockMode = this.lockMode;
        if (this.nameTag !== undefined)
            obj.nameTag = this.nameTag;
        if (this.lore.length > 0)
            obj.lore = this.lore;
        if (this.tags.size > 0)
            obj.tags = this.tags;

        const comps = new Set<any>();
        if (this.cooldown && this.cooldown.category !== "")
            comps.add(this.cooldown);
        if (this.durability)
            comps.add(this.durability);
        if (this.enchantments.size > 0)
            comps.add(this.enchantments);
        for (const comp of this.raw.getComponents()) {
            switch (comp.typeId) {
                case ItemCooldown.typeId:
                case ItemDurability.typeId:
                case ItemEnchantments.typeId:
                case "minecraft:enchantments": // FIXME: Remove this when the API is updated to 1.9.0
                    // These are already inspected in our own way.
                    break;
                default:
                    comps.add(comp);
            }
        }
        if (comps.size > 0)
            obj.components = comps;

        return PP.spaceCat(
            stylise(PP.text("ItemStack"), I.TokenType.Class),
            inspect(obj));
    }

    /// @internal
    public inspectTersely(inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                          stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc,
                          _opts: Required<I.InspectOptions>): PP.Doc {
        let doc = inspect(this.typeId);
        if (this.isStackable)
            doc = PP.spaceCat(
                doc,
                stylise(
                    PP.parens(
                        PP.spaceCat(
                            PP.text("amount:"),
                            inspect(this.amount))),
                    I.TokenType.Tag));
        return doc;
    }
}
