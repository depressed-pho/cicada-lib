import { ItemStack } from "./item/stack.js";
import { FixedSparseArrayLike } from "./exotic/array-like.js";
import { ContainerSlot } from "./container/slot.js";
import * as I from "./inspect.js";
import * as PP from "./pprint.js";
import * as MC from "@minecraft/server";

/** A `Container` is an `Array`-like object having {@link ItemStack} as
 * elements. It supports index notation (i.e. `obj[i]`) like the actual
 * array. Since the size of a container is fixed, {@link length} is
 * read-only.
 */
export class Container extends FixedSparseArrayLike<ItemStack> implements I.HasCustomInspection {
    /// @internal
    readonly raw: MC.Container;

    /// @internal
    public constructor(raw: MC.Container) {
        super(raw.size, {
            "get"(index: number): ItemStack|undefined {
                const item = raw.getItem(index);
                return item ? new ItemStack(item) : undefined;
            },
            "set"(index: number, value: ItemStack): void {
                raw.setItem(index, value.raw);
            },
            "delete"(index: number): void {
                raw.setItem(index, undefined);
            },
            has(index: number): boolean {
                return !!raw.getItem(index);
            },
            clone(value: ItemStack): ItemStack {
                return value.clone();
            }
        });
        this.raw = raw;
    }

    /** The number of empty slots in the container.
     */
    public get emptySlotsCount(): number {
        return this.raw.emptySlotsCount;
    }

    /** Add an item to the container. The item is placed in the first
     * available slot(s) and can be stacked with existing items of the same
     * type. Note, use the `obj[idx] = item` notation if you wish to set
     * the item in a particular slot.
     *
     * @return A stack that didn't fit in the container, or `undefined` if
     * the entire stack could be stored.
     */
    public add(item: ItemStack): ItemStack|undefined {
        const ret = this.raw.addItem(item.raw);
        return ret ? new ItemStack(ret) : undefined;
    }

    /** Return a container slot object, which acts as a reference to a slot
     * at the given index for this container. Throws an error if the `slot`
     * index is out of bounds.
     */
    public slot(index: number): ContainerSlot {
        return new ContainerSlot(this.raw.getSlot(index));
    }

    /** `sort()` is similar to `Array.prototype.sort()` but not exactly the
     * same. A comparator function is not optional but is mandatory, as
     * there is no defined order in item stacks.
     */
    public override sort(cmp: (a: ItemStack, b: ItemStack) => number): this {
        if (!cmp)
            throw new TypeError(`A comparator function has to be given`);
        return super.sort(cmp);
    }

    /// @internal
    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                                   stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc,
                                   opts: Required<I.InspectOptions>): PP.Doc {
        // Displaying the entire ItemStack for each slot would be too
        // verbose. Do it when showHidden is enabled, otherwise only show
        // their item IDs and amounts, like:
        //
        // Container(36) [
        //     "minecraft:netherite_pickaxe",
        //     <34 empty slots>,
        //     "minecraft:torch" (amount: 64)
        // ]
        const sizeDoc        = stylise(PP.parens(PP.number(this.length)), I.TokenType.Tag);
        const prefix         = PP.beside(stylise(PP.text("Container"), I.TokenType.Class), sizeDoc);
        const numElemsToShow = Math.min(this.length, opts.maxArrayLength);
        const elems          = [] as PP.Doc[];

        let expectedIdx = 0;
        let numHidden = 0;
        for (const [slot, item] of this.entries()) {
            if (elems.length >= numElemsToShow) {
                numHidden++;
                continue;
            }

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

        if (expectedIdx < this.length) {
            const numHoles = this.length - expectedIdx;
            elems.push(
                stylise(
                    PP.text(`<${numHoles} empty slot${numHoles > 1 ? "s" : ""}>`),
                    I.TokenType.Undefined));
            expectedIdx = this.length;
        }

        if (numHidden > 0)
            elems.push(
                stylise(
                    PP.fillSep(
                        [ PP.text("..."),
                          stylise(PP.number(numHidden), I.TokenType.Number),
                          PP.text("more"),
                          PP.text("item"),
                          PP.text("stack" + (numHidden > 1 ? "s" : ""))
                        ]),
                    I.TokenType.Special));

        if (elems.length > 0)
            // If the entire object fits the line, print it in a single
            // line. Otherwise break lines for each items.
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
