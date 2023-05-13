import { ItemStack } from "./item/stack.js";
import { Wrapper } from "./wrapper.js";
import * as MC from "@minecraft/server";

export class Container extends Wrapper<MC.Container> implements Iterable<ItemStack> {
    public *[Symbol.iterator](): IterableIterator<ItemStack> {
        for (let i = 0; i < this.raw.size; i++) {
            const item = this.raw.getItem(i);
            if (item) {
                yield new ItemStack(item);
            }
        }
    }

    public add(item: ItemStack): this {
        this.raw.addItem(item.raw);
        return this;
    }

    public some(p: (item: ItemStack, slot: number) => boolean): boolean {
        for (let i = 0; i < this.raw.size; i++) {
            const item = this.raw.getItem(i);
            if (item) {
                if (p(new ItemStack(item), i)) {
                    return true;
                }
            }
        }
        return false;
    }
}
