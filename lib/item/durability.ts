import { ItemEnchantments } from "./enchantments.js";
import { Wrapper } from "../wrapper.js";
import * as I from "../inspect.js";
import * as PP from "../pprint.js";
import * as MC from "@minecraft/server";

export class ItemDurability
    extends Wrapper<MC.ItemDurabilityComponent>
    implements I.HasCustomInspection {

    readonly #enchantments;

    /// @internal
    public constructor(raw: MC.ItemDurabilityComponent, enchantments: ItemEnchantments) {
        super(raw);
        this.#enchantments = enchantments;
    }

    /** Return the current durability of the item. Items will zero
     * durability will likely to break on the next use.
     */
    public get current(): number {
        return this.raw.maxDurability - this.raw.damage;
    }

    /** Update the current durability of the item.
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
        const level  = this.#enchantments.get("unbreaking") ?? 0;
        const chance = this.raw.getDamageChance(level);
        return chance / 100.0;
    }

    /** Apply a damage to the tool, taking account of its Unbreaking
     * level. The damage should usually be 1 for its primary use, and 2 for
     * non-primary uses (like using pickaxes for digging dirt). Return
     * `true` if it exceeded the maximum damage the item can take, i.e. it
     * should break. `false` otherwise.
     */
    public damage(amount: number): boolean {
        if (Math.random() < this.damageChance) {
            if (this.current >= amount) {
                this.current -= amount;
                return false;
            }
            else {
                this.current = 0;
                return true;
            }
        }
        return false;
    }

    /// @internal
    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                                   stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc): PP.Doc {
        const obj: any = {
            current: this.current,
            maximum: this.maximum,
        };
        try {
            if (this.damageChance < 1)
                obj.damageChance = this.damageChance;
        }
        catch (e) {
            // ItemDurabilityComponent.prototype.getDamageChance() isn't
            // callable in read-only mode.
            Object.defineProperty(obj, "damageChance", {
                get:        () => this.damageChance,
                enumerable: true
            });
        }
        return PP.spaceCat(
            stylise(PP.text("ItemDurability"), I.TokenType.Class),
            inspect(obj));
    }
}
