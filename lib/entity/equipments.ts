import { ItemStack } from "../item/stack.js";
import { Wrapper } from "../wrapper.js";
import { EquipmentSlot } from "@minecraft/server";
import * as MC from "@minecraft/server";

export { EquipmentSlot };

const SLOTS: EquipmentSlot[] = [
    EquipmentSlot.Chest,
    EquipmentSlot.Feet,
    EquipmentSlot.Head,
    EquipmentSlot.Legs,
    EquipmentSlot.Mainhand,
    EquipmentSlot.Offhand
];

export class EntityEquipments extends Wrapper<MC.EntityEquippableComponent> implements Map<EquipmentSlot, ItemStack> {
    public get size(): number {
        let n = 0;
        for (const slot of SLOTS) {
            if (this.has(slot))
                n++;
        }
        return n;
    }

    public get [Symbol.toStringTag](): string {
        return "EntityEquipments";
    }

    public [Symbol.iterator](): IterableIterator<[EquipmentSlot, ItemStack]> {
        return this.entries();
    }

    public clear(): void {
        for (const slot of SLOTS) {
            this.delete(slot);
        }
    }

    public delete(slot: EquipmentSlot): boolean {
        if (this.has(slot)) {
            this.raw.setEquipment(slot, undefined);
            return true;
        }
        else {
            return false;
        }
    }

    public *entries(): IterableIterator<[EquipmentSlot, ItemStack]> {
        for (const slot of SLOTS) {
            const stack = this.get(slot);
            if (stack)
                yield [slot, stack];
        }
    }

    public forEach(f: (value: ItemStack, key: EquipmentSlot, map: EntityEquipments) => void, thisArg?: any): void {
        const boundF = f.bind(thisArg);
        for (const [slot, stack] of this) {
            boundF(stack, slot, this);
        }
    }

    public "get"(slot: EquipmentSlot): ItemStack|undefined {
        const raw = this.raw.getEquipment(slot);
        return raw ? new ItemStack(raw) : undefined;
    }

    public has(slot: EquipmentSlot): boolean {
        return !!this.get(slot);
    }

    public *keys(): IterableIterator<EquipmentSlot> {
        for (const slot of SLOTS) {
            if (this.has(slot))
                yield slot;
        }
    }

    public "set"(slot: EquipmentSlot, stack: ItemStack): this {
        this.raw.setEquipment(slot, stack.raw);
        return this;
    }

    public *values(): IterableIterator<ItemStack> {
        for (const slot of SLOTS) {
            const stack = this.get(slot);
            if (stack)
                yield stack;
        }
    }
}
