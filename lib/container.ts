import { ItemStack } from "./item/stack.js";
import { Wrapper } from "./wrapper.js";
import { FixedSparseArrayLike } from "./exotic/array-like.js";
import * as I from "./inspect.js";
import * as PP from "./pprint.js";
import * as MC from "@minecraft/server";

function clamp(n: number, min: number, max: number, negOffset = max): number {
    if (n < 0)
        n += negOffset;

    if (n < min)
        n = min;
    else if (n > max)
        n = max;

    return n;
}

/** A `Container` is an `Array`-like object having {@link ItemStack} as
 * elements. It supports index notation (i.e. `obj[i]`) like the actual
 * array. Since the size of a container is fixed, {@link length} is
 * read-only.
 */
export class Container extends FixedSparseArrayLike<ItemStack, new (raw: MC.Container) => Wrapper<MC.Container>>(Wrapper<MC.Container>) implements Iterable<ItemStack>, I.HasCustomInspection {
    // NOTE: The reason for the second type argument to
    // FixedSparseArrayLike not being inferred is
    // https://github.com/microsoft/TypeScript/issues/10571

    /// @internal
    "get"(index: number): ItemStack|undefined {
        const item = this.raw.getItem(index);
        return item ? new ItemStack(item) : undefined;
    }

    /// @internal
    "set"(index: number, value: ItemStack): void {
        this.raw.setItem(index, value.raw);
    }

    /// @internal
    "delete"(index: number): void {
        this.raw.setItem(index, undefined);
    }

    /// @internal
    override "has"(index: number): boolean {
        return !!this.raw.getItem(index);
    }

    public [Symbol.isConcatSpreadable] = true;

    public [Symbol.iterator](): IterableIterator<ItemStack> {
        return this.values();
    }

    /** The number of empty slots in the container.
     */
    public get emptySlotsCount(): number {
        return this.raw.emptySlotsCount;
    }

    public get length(): number {
        return this.raw.size;
    }

    public at(slot: number): ItemStack|undefined {
        slot = clamp(slot, 0, this.raw.size);
        return this[slot];
    }

    /** Add an item to the container. The item is placed in the first
     * available slot(s) and can be stacked with existing items of the same
     * type. Note, use the `obj[idx] = item` notation if you wish to set
     * the item in a particular slot.
     * @return FIXME: what the heck does it return?
     */
    public add(item: ItemStack): ItemStack|undefined {
        const ret = this.raw.addItem(item.raw);
        return ret ? new ItemStack(ret) : undefined;
    }

    /** `copyWithin()` works differently from
     * `Array.prototype.copyWithin()`. It clones item stacks instead of
     * duplicating references.
     */
    public copyWithin(target: number, start: number, end?: number): this {
        target = clamp(target, 0, this.raw.size);
        start  = clamp(start , 0, this.raw.size);
        if (end !== undefined)
            end = clamp(end, 0, this.raw.size);
        else
            end = this.raw.size;

        const count = Math.min(end - start, this.raw.size - target);
        const dir   = (start < target && target < start + count) ? -1 : +1;
        for (let i = 0; i < count; ) {
            let from, to;
            if (dir < 0) {
                from = start  + count - i - 1;
                to   = target + count - i - 1;
            }
            else {
                from = start  + i;
                to   = target + i;
            }

            const item = this.raw.getItem(from);
            this.raw.setItem(to, item?.clone());
        }

        return this;
    }

    public concat(...items: (ItemStack | Array<ItemStack>)[]): ItemStack[] {
        return Array.prototype.concat.apply(this, items);
    }

    public *entries(): IterableIterator<[number, ItemStack]> {
        for (let i = 0; i < this.raw.size; i++) {
            const item = this.raw.getItem(i);
            if (item) {
                yield [i, new ItemStack(item)];
            }
        }
    }

    public every(p: (item: ItemStack, slot: number, self: Container) => unknown, thisArg?: any): boolean {
        return Array.prototype.every.call(this, p as any, thisArg);
    }

    /** `fill()` works differently from `Array.prototype.fill()`. It clones
     * item stacks instead of duplicating references.
     */
    public fill(item: ItemStack, start: number, end?: number): this {
        start = clamp(start, 0, this.raw.size);
        if (end !== undefined)
            end = clamp(end, 0, this.raw.size);
        else
            end = this.raw.size;

        for (let i = start; i < end; i++)
            this.raw.setItem(i, item.raw.clone());
        return this;
    }

    public filter(p: (item: ItemStack, slot: number, self: Container) => unknown, thisArg?: any): ItemStack[] {
        return Array.prototype.filter.call(this, p as any, thisArg);
    }

    public find(p: (item: ItemStack, slot: number, self: Container) => unknown, thisArg?: any): ItemStack|undefined {
        // We can't use Array.prototype.find() because it doesn't skip empty slots.
        const boundP = p.bind(thisArg);
        for (const [slot, item] of this.entries()) {
            if (!boundP(item, slot, this))
                return item;
        }
        return undefined;
    }

    public findIndex(p: (item: ItemStack, slot: number, self: Container) => unknown, thisArg?: any): number {
        const boundP = p.bind(thisArg);
        for (const [slot, item] of this.entries()) {
            if (!boundP(item, slot, this))
                return slot;
        }
        return -1;
    }

    public findLast(p: (item: ItemStack, slot: number, self: Container) => unknown, thisArg?: any): ItemStack|undefined {
        const boundP = p.bind(thisArg);
        for (let i = this.raw.size - 1; i >= 0; i--) {
            const item = this[i];
            if (item && boundP(item, i, this))
                return item;
        }
        return undefined;
    }

    public findLastIndex(p: (item: ItemStack, slot: number, self: Container) => unknown, thisArg?: any): number {
        const boundP = p.bind(thisArg);
        for (let i = this.raw.size - 1; i >= 0; i--) {
            const item = this[i];
            if (item && boundP(item, i, this))
                return i;
        }
        return -1;
    }

    // flat() is missing as it makes no sense in the context of Container.
    // flatMap() is missing as it makes no sense in the context of Container.

    public forEach(f: (item: ItemStack, slot: number, self: Container) => unknown, thisArg?: any): void {
        Array.prototype.forEach.call(this, f as any, thisArg);
    }

    // includes() is missing as we cannot test if two item stacks are
    // equivalent at the moment.

    // indexOf() is missing as we cannot test if two item stacks are
    // equivalent at the moment.

    // join() is missing as it makes no sense in the context of Container.

    public *keys(): IterableIterator<number> {
        for (let i = 0; i < this.raw.size; i++) {
            const item = this.raw.getItem(i);
            if (item)
                yield i;
        }
    }

    // lastIndexOf() is missing as we cannot test if two item stacks are
    // equivalent at the moment.

    public map<T>(f: (item: ItemStack, slot: number, self: Container) => T, thisArg?: any): T[] {
        return Array.prototype.map.call(this, f as any, thisArg) as T[];
    }

    /** `pop()` works differently from `Array.prototype.pop()`. It removes
     * the item stack at the last non-empty slot of the container and
     * returns it. Since containers have a fixed size, it will not change
     * the value of {@link length}.
     */
    public pop(): ItemStack|undefined {
        for (let i = this.raw.size - 1; i >= 0; i--) {
            const item = this.raw.getItem(i);
            if (item) {
                this.raw.setItem(i, undefined);
                return new ItemStack(item);
            }
        }
        return undefined;
    }

    /** `push()` works differently from `Array.prototype.push()`. It places
     * the item stacks at empty slots following the last non-empty slot of
     * the container, or throws `RangeError` if no such slot exists. Since
     * containers have a fixed size, it will not change the value of {@link
     * length}. This method does not merge item stacks. If you just want to
     * add items to the container, consider using {@link add} instead.
     */
    public push(...items: ItemStack[]): number {
        for (let i = this.raw.size; i >= 0; i--) {
            if (this.raw.getItem(i)) {
                i++;
                if (this.raw.size - i >= items.length) {
                    for (let j = 0; j < items.length; j++, i++)
                        this.raw.setItem(i, items[j]!.raw);
                    return this.raw.size;
                }
            }
        }
        throw new RangeError(`The container has nowhere to push items`);
    }

    public reduce(f: (acc: ItemStack, item: ItemStack, slot: number, self: Container) => ItemStack): ItemStack;
    public reduce<Acc>(f: (acc: Acc, item: ItemStack, slot: number, self: Container) => Acc, init: Acc): Acc;
    public reduce(f: any, init?: any) {
        return Array.prototype.reduce.call(this, f, init);
    }

    public reduceRight(f: (acc: ItemStack, item: ItemStack, slot: number, self: Container) => ItemStack): ItemStack;
    public reduceRight<Acc>(f: (acc: Acc, item: ItemStack, slot: number, self: Container) => Acc, init: Acc): Acc;
    public reduceRight(f: any, init?: any) {
        return Array.prototype.reduceRight.call(this, f, init);
    }

    public reverse(): this {
        Array.prototype.reverse.call(this);
        return this;
    }

    /** `shift()` works differently from `Array.prototype.shift()`. It removes
     * the item stack at the first non-empty slot of the container and
     * returns it. Since containers have a fixed size, it will not change
     * the value of {@link length}.
     */
    public shift(): ItemStack|undefined {
        for (let i = 0; i < this.raw.size; i++) {
            const item = this.raw.getItem(i);
            if (item) {
                this.raw.setItem(i, undefined);
                return new ItemStack(item);
            }
        }
        return undefined;
    }

    public slice(start?: number, end?: number): ItemStack[] {
        return Array.prototype.slice.call(this, start, end);
    }

    public some(p: (item: ItemStack, slot: number, self: Container) => unknown, thisArg?: any): boolean {
        const boundP = p.bind(thisArg);
        for (const [slot, item] of this.entries()) {
            if (boundP(item, slot, this))
                return true;
        }
        return false;
    }

    /** `sort()` is similar to `Array.prototype.sort()` but not exactly the
     * same. A comparator function is not optional but is mandatory, as
     * there is no defined order in item stacks.
     */
    public sort(cmp: (a: ItemStack, b: ItemStack) => number): this {
        if (!cmp)
            throw new TypeError(`A comparator function has to be given`);
        Array.prototype.sort.call(this, cmp);
        return this;
    }

    public splice(start: number, deleteCount?: number): ItemStack[];
    public splice(start: number, deleteCount: number, ...items: ItemStack[]): ItemStack[];
    public splice(...args: any[]) {
        // @ts-ignore: TypeScript can't prove this is well-typed.
        return Array.prototype.splice.apply(this, args);
    }

    // toReversed() is missing because non-sparse arrays don't make sense for ItemStack[].
    // toSorted() is missing because non-sparse arrays don't make sense for ItemStack[].
    // toSpliced() is missing because non-sparse arrays don't make sense for ItemStack[].

    /** `unshift()` works differently from `Array.prototype.unshift()`. It
     * places the item stacks at empty slots preceding the first non-empty
     * slot of the container, or throws `RangeError` if no such slots
     * exist. Since containers have a fixed size, it will not change the
     * value of {@link length}. This method does not merge item stacks. If
     * you just want to add items to the container, consider using {@link
     * add} instead.
     */
    public unshift(...items: ItemStack[]): number {
        for (let i = 0; i < this.raw.size; i++) {
            if (this.raw.getItem(i)) {
                i -= items.length;;
                if (i >= 0) {
                    for (let j = 0; j < items.length; j++, i++)
                        this.raw.setItem(i, items[j]!.raw);
                    return this.raw.size;
                }
            }
        }
        throw new RangeError(`The container has nowhere to unshift items`);
    }

    public *values(): IterableIterator<ItemStack> {
        for (let i = 0; i < this.raw.size; i++) {
            const item = this.raw.getItem(i);
            if (item)
                yield new ItemStack(item);
        }
    }

    /// @internal
    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                                   stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc,
                                   opts: Required<I.InspectOptions>): PP.Doc {
        // Displaying the entire ItemStack for each slot would be too
        // verbose. Do it when showHidden is enabled, otherwise only show
        // their item IDs and amounts, like:
        //
        // [Container](36) [
        //     "minecraft:netherite_pickaxe",
        //     <34 empty slots>,
        //     "minecraft:torch" (amount: 64)
        // ]
        const prefix         = stylise(PP.text("Container"), I.TokenType.Class);
        const numElemsToShow = Math.min(this.length, opts.maxArrayLength);
        const elems          = [] as PP.Doc[];

        let expectedIdx = 0;
        for (const [slot, item] of this.entries()) {
            if (elems.length >= numElemsToShow)
                break;

            if (expectedIdx !== slot) {
                const numHoles = slot - expectedIdx;
                elems.push(
                    stylise(
                        PP.text(`<${numHoles} empty slot${numHoles > 1 ? "s" : ""}>`),
                        I.TokenType.Undefined));
                expectedIdx = slot;
            }

            if (opts.showHidden)
                elems.push(inspect(item));
            else
                elems.push(item.inspectTersely(inspect, stylise, opts));

            expectedIdx++;
        }

        const numHidden = this.length - expectedIdx;
        if (numHidden > 0)
            elems.push(
                stylise(
                    PP.fillSep(
                        `... ${numHidden} more item${numHidden > 1 ? "s" : ""}`.split(" ").map(PP.text)),
                    I.TokenType.Special));

        if (elems.length > 0)
            // If the entire object fits the line, print it in a single
            // line. Otherwise break lines for each enchantments.
            return PP.spaceCat(
                prefix,
                PP.group(
                    PP.lineCat(
                        PP.nest(
                            opts.indentationWidth,
                            PP.lineCat(
                                PP.lbracket,
                                PP.vsep(
                                    PP.punctuate(PP.comma, elems)))),
                        PP.rbracket)));
        else
            return PP.spaceCat(prefix, PP.braces(PP.empty));
    }
}
