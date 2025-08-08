import { HasDynamicProperties } from "../dynamic-props.js";
import { ItemStack } from "../item/stack.js";
import { ItemTags } from "../item/tags.js";
import { ItemType } from "../item/type.js";
import { Wrapper } from "../wrapper.js";
import { ItemLockMode, RawMessage } from "@minecraft/server";
import * as MC from "@minecraft/server";

export { ItemLockMode };

/** Represents a slot within a broader container (e.g., entity
 * inventory.)
 */
export class ContainerSlot extends HasDynamicProperties(Wrapper<MC.ContainerSlot>) {
    public get amount(): number {
        return this.raw.amount;
    }
    public set amount(n: number) {
        this.raw.amount = n;
    }

    public get isStackable(): boolean {
        return this.raw.isStackable;
    }

    public get isValid(): boolean {
        return this.raw.isValid;
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

    public get maxAmount(): number {
        return this.raw.maxAmount;
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

    public get type(): ItemType {
        return new ItemType(this.raw.type);
    }

    public get typeId(): string {
        return this.raw.typeId;
    }

    // FIXME: getters canDestroy() and canPlaceOn() for a returning dynamic
    // Set-like object.

    /** Return a snapshot of the item in the slot, or `undefined` if the
     * slot is empty.
     */
    public get item(): ItemStack|undefined {
        const rawStack = this.raw.getItem();
        return rawStack ? new ItemStack(rawStack) : undefined;
    }
    /** Set the given ItemStack in the slot, replacing any existing
     * item.
     */
    public set item(stack: ItemStack|undefined) {
        this.raw.setItem(stack?.raw);
    }

    public get lore(): string[] {
        return this.raw.getLore();
    }
    public set lore(lore: string[]) {
        this.raw.setLore(lore);
    }

    public get rawLore(): RawMessage[] {
        return this.raw.getRawLore();
    }
    public set rawLore(lore: RawMessage[]) {
        this.raw.setLore(lore);
    }

    public get tags(): ItemTags {
        return new ItemTags(this.raw);
    }

    public get hasItem(): boolean {
        return this.raw.hasItem();
    }

    public isStackableWith(stack: ItemStack): boolean {
        return this.raw.isStackableWith(stack.raw);
    }
}
