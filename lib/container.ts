import { ItemStack } from "./item-stack.js";
import * as MC from "@minecraft/server";

export class Container implements Iterable<ItemStack> {
    readonly #container: MC.Container;

    /** The constructor is public only because of a language
     * limitation. User code must never call it directly. */
    public constructor(rawContainer: MC.Container) {
        this.#container = rawContainer;
    }

    public *[Symbol.iterator](): Iterator<ItemStack> {
        for (let i = 0; i < this.#container.size; i++) {
            const item = this.#container.getItem(i);
            if (item) {
                yield new ItemStack(item);
            }
        }
    }

    public add(item: ItemStack): this {
        this.#container.addItem(item.raw);
        return this;
    }

    public some(p: (item: ItemStack, slot: number) => boolean): boolean {
        for (let i = 0; i < this.#container.size; i++) {
            const item = this.#container.getItem(i);
            if (item) {
                if (p(new ItemStack(item), i)) {
                    return true;
                }
            }
        }
        return false;
    }
}
