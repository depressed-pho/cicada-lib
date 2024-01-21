import { ItemEnchantments } from "./enchantments.js";
import { Wrapper } from "../wrapper.js";
import * as MC from "@minecraft/server";

export class ItemDurability extends Wrapper<MC.ItemDurabilityComponent> {
    readonly #enchantments;

    /// @internal
    public constructor(raw: MC.ItemDurabilityComponent, enchantments: ItemEnchantments) {
        super(raw);
        this.#enchantments = enchantments;
    }

    /** Return the current durability of the item. */
    public get current(): number {
        return this.raw.maxDurability - this.raw.damage;
    }

    /** Update the current durability of the item. For item stacks
     * referencing an actual item in the game, such as one in a player
     * inventory, setting this to 0 will break the item.
     */
    public set current(durability: number) {
        this.raw.damage = this.raw.maxDurability - durability;
    }

    /** Return the maximum amount of damage that this item can take before
     * breaking.
     */
    public get maximum(): number {
        return this.raw.maxDurability;
    }

    /** Return the chance that this item would be damaged, taking account
     * of its Unbreaking level. The returned value is in the range of [0, 1].
     */
    public get damageChance(): number {
        const level  = this.#enchantments.get("unbreaking")?.level ?? 0;
        const chance = this.raw.getDamageChance(level);
        return chance / 100.0;
    }

    /** Apply a damage to the tool, taking account of its Unbreaking
     * level. The damage should usually be 1 for its primary use, and 2 for
     * non-primary uses (like using pickaxes for digging dirt).
     */
    public damage(amount: number): this {
        if (Math.random() < this.damageChance)
            this.current = Math.max(0, this.current - amount);
        return this;
    }
}
