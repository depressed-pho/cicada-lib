import { ItemStack } from "./stack.js";

/** An ItemBag is a set of item stacks. It behaves like `ItemStack[]` but
 * supports merging and splitting stacks.
 */
export class ItemBag implements Set<ItemStack> {
    readonly #stacks: Map<string, ItemStack[]>;

    public constructor() {
        this.#stacks = new Map();
    }

    /** Return the number of item stacks in the bag without regard to their
     * amounts.
     */
    public get size(): number {
        let total = 0;
        for (const stacks of this.#stacks.values()) {
            total += stacks.length;
        }
        return total;
    }

    public get [Symbol.toStringTag](): string {
        return "ItemTags";
    }

    public [Symbol.iterator](): IterableIterator<ItemStack> {
        return this.values();
    }

    /** Add an item stack to the bag. If `amount` is specified the `stack`
     * will be duplicated `amount` times, that is, if `stack.amount` is 2
     * and `amount` is 3 it will add 6 items to the bag. This method does
     * not mutate `stack` nor hold any references to it.
     */
    public add(stack: ItemStack, amount = 1): this {
        let stacks = this.#stacks.get(stack.typeId);
        if (!stacks) {
            stacks = [];
            this.#stacks.set(stack.typeId, stacks);
        }

        // Try to merge the stack with existing ones as far as possible.
        let total = stack.amount * amount;
        for (const st of stacks) {
            if (st.isStackableWith(stack)) {
                const numTaken = Math.min(st.maxAmount - st.amount, total);
                if (numTaken > 0) {
                    st.amount += numTaken;
                    total     -= numTaken;

                    if (total <= 0)
                        break;
                }
            }
        }

        // Impossible to merge stacks any further. Create more.
        while (total > 0) {
            const st = stack.clone();
            st.amount = Math.min(st.maxAmount, total);
            stacks.push(st);
            total -= st.amount;
        }

        return this;
    }

    public clear(): void {
        this.#stacks.clear();
    }

    /** Delete an item stack from the bag and return `true` iff it
     * exists. If the bag contains `stack` only partially, this function
     * still deletes it and returns `true` if `partial` is
     * `true`. Otherwise it returns `false` without changing anything.
     */
    public delete(stack: ItemStack, partial = true): boolean {
        let   total  = stack.amount;
        const stacks = this.#stacks.get(stack.typeId);

        if (stacks) {
            const stacks1: ItemStack[] = [];
            for (let i = 0; i < stacks.length && total > 0; i++) {
                const st = stacks[i]!;
                if (st.isStackableWith(stack)) {
                    const numTaken = Math.min(st.amount, total);
                    total -= numTaken;
                    if (numTaken < st.amount) {
                        // This stack does not become empty but its amount
                        // is reduced. We must clone it because we may have
                        // to rollback the changes later.
                        const st1 = st.clone();
                        st1.amount -= numTaken;
                        stacks1.push(st1);
                    }
                }
            }
            if (stack.amount - total > 0) {
                // We deleted at least one item.
                if (partial || total <= 0) {
                    this.#stacks.set(stack.typeId, stacks1);
                    return true;
                }
            }
        }
        return false;
    }

    public *entries(): IterableIterator<[ItemStack, ItemStack]> {
        for (const st of this) {
            yield [st, st];
        }
    }

    public forEach(f: (value: ItemStack, value2: ItemStack, set: ItemBag) => void, thisArg?: any): void {
        const boundF = f.bind(thisArg);
        for (const st of this) {
            boundF(st, st, this);
        }
    }

    /** Return `true` iff the bag contains `stack`. The function also
     * returns `false` if the bag has only a part of `stack` and `partial`
     * is `true`. Otherwise it returns `false`.
     */
    public has(stack: ItemStack, partial = true): boolean {
        let   total  = stack.amount;
        const stacks = this.#stacks.get(stack.typeId);

        if (stacks) {
            for (const st of stacks) {
                if (total <= 0) {
                    break;
                }
                else if (st.isStackableWith(stack)) {
                    const numTaken = Math.min(st.amount, total);
                    total -= numTaken;
                }
            }
            if (stack.amount - total > 0) {
                // We found at least one item.
                if (partial || total <= 0)
                    return true;
            }
        }
        return false;
    }

    public keys(): IterableIterator<ItemStack> {
        return this.values();
    }

    /** Merge another bag into this bag. This function does not mutate
     * `bag` nor hold any references to it.
     */
    public merge(bag: ItemBag): this {
        for (const st of bag) {
            this.add(st);
        }
        return this;
    }

    public *values(): IterableIterator<ItemStack> {
        for (const stacks of this.#stacks.values()) {
            yield* stacks;
        }
    }
}
