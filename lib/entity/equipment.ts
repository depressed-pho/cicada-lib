import { ContainerSlot } from "../container/slot.js";
import { ItemStack } from "../item/stack.js";
import { EntityComponent } from "./component.js";
import { EquipmentSlot } from "@minecraft/server";
import * as I from "../inspect.js";
import * as PP from "../pprint.js";
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

export class EntityEquipment extends EntityComponent<MC.EntityEquippableComponent> implements Map<EquipmentSlot, ItemStack>, I.HasCustomInspection {
    public static readonly typeId = "minecraft:equippable";

    public get size(): number {
        let n = 0;
        for (const slot of SLOTS) {
            if (this.has(slot))
                n++;
        }
        return n;
    }

    public get [Symbol.toStringTag](): string {
        return "EntityEquipment";
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

    public forEach(f: (value: ItemStack, key: EquipmentSlot, map: EntityEquipment) => void, thisArg?: any): void {
        const boundF = f.bind(thisArg);
        for (const [slot, stack] of this) {
            boundF(stack, slot, this);
        }
    }

    /** Get the equipped item in the given slot. The returned object is
     * only a copy of the item in the slot. It does not reflect future
     * state changes, and mutating it has no effects on the original
     * item.
     */
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

    public slot(slot: EquipmentSlot): ContainerSlot {
        return new ContainerSlot(this.raw.getEquipmentSlot(slot));
    }

    public *values(): IterableIterator<ItemStack> {
        for (const slot of SLOTS) {
            const stack = this.get(slot);
            if (stack)
                yield stack;
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
        // EntityEquipment {
        //     Mainhand => "minecraft:netherite_pickaxe",
        //     Offhand => "minecraft:torch" (amount: 64)
        // }
        const prefix = stylise(PP.text("EntityEquipment"), I.TokenType.Class);
        const elems  = [] as PP.Doc[];
        try {
            for (const [slot, stack] of this) {
                let value;
                if (opts.showHidden)
                    value = inspect(stack);
                else
                    value = stack.inspectTersely(inspect, stylise, opts);

                elems.push(
                    PP.fillSep([
                        stylise(PP.text(slot), I.TokenType.Name),
                        PP.text("=>"),
                        value
                    ]));
            }
        }
        catch (e) {
            // EntityEquippableComponent.prototype.getEquipment() isn't
            // callable in read-only mode.
            if (I.looksLikeReadonlyError(e))
                elems.push(
                    stylise(
                        PP.text("<data unavailable in read-only mode>"), I.TokenType.Special));
            else
                throw e;
        }
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
                                PP.lbrace,
                                PP.vsep(
                                    PP.punctuate(PP.comma, elems)))),
                        PP.rbrace)));
        else
            return PP.spaceCat(prefix, PP.braces(PP.empty));
    }
}
