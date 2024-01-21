import { ItemEnchantments } from "./enchantment.js";
import { Wrapper } from "../wrapper.js";
import * as MC from "@minecraft/server";

export class ItemDurability extends Wrapper<MC.ItemDurabilityComponent> {
    readonly #enchantments;

    /// @internal
    public constructor(dur: ItemDurability);
    /// @internal
    public constructor(raw: MC.ItemDurabilityComponent, enchantments: ItemEnchantments);
    public constructor(...args: any[]) {
        if (args.length == 1) {
            super(args[0].raw);
            this.#enchantments = args[0].#enchantments;
        }
        else {
            super(args[0]);
            this.#enchantments = args[1];
        }
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

    /// @internal
    public reference(onMutate: () => void): ItemDurability {
        return new ItemDurabilityRef(this, onMutate);
    }
}

class ItemDurabilityRef extends ItemDurability {
    readonly #onMutate: () => void;

    public constructor(dur: ItemDurability, onMutate: () => void) {
        super(dur);
        this.#onMutate = onMutate;
    }

    public override set current(durability: number) {
        super.current = durability;
        this.#onMutate();
    }
}
