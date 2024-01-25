import { Wrapper } from "../wrapper.js";
import { EnchantmentType } from "@minecraft/server";
import * as I from "../inspect.js";
import * as PP from "../pprint.js";
import * as MC from "@minecraft/server";

export { EnchantmentType };

export class ItemEnchantments
    extends Wrapper<MC.ItemEnchantableComponent|undefined>
    implements Map<EnchantmentType, number>, I.HasCustomInspection {

    public static "type"(enchantmentId: string): EnchantmentType|undefined {
        return MC.EnchantmentTypes.get(enchantmentId);
    }

    public get size(): number {
        // FIXME: Remove this glue code when the API is updated to 1.9.0.
        if (this.raw && "enchantments" in this.raw) {
            // @ts-ignore
            const list: any = this.raw.enchantments;
            let length = 0;
            for (const _ench of list) {
                length++;
            }
            return length;
        }

        return this.raw ? this.raw.getEnchantments().length : 0;
    }

    public get [Symbol.toStringTag](): string {
        return "ItemEnchantments";
    }

    public [Symbol.iterator](): IterableIterator<[EnchantmentType, number]> {
        return this.entries();
    }

    public canSet(type: EnchantmentType|string, level: number): boolean {
        // FIXME: Remove this glue code when the API is updated to 1.9.0.
        if (this.raw && "enchantments" in this.raw) {
            // @ts-ignore
            return this.raw.enchantments.canAddEnchantment(new MC.Enchantment(type, level));
        }

        return this.raw
            ? this.raw.canAddEnchantment({type, level})
            : false;
    }

    public clear(): void {
        if (this.raw) {
            this.raw.removeAllEnchantments();
        }
    }

    public delete(type: EnchantmentType|string): boolean {
        if (this.has(type)) {
            // FIXME: Remove this glue code when the API is updated to 1.9.0.
            if (this.raw && "enchantments" in this.raw) {
                // @ts-ignore
                this.raw.enchantments.removeEnchantment(type);
                return true;
            }

            this.raw!.removeEnchantment(type);
            return true;
        }
        else {
            return false;
        }
    }

    public *entries(): IterableIterator<[EnchantmentType, number]> {
        if (this.raw) {
            // FIXME: Remove this glue code when the API is updated to 1.9.0.
            if (this.raw && "enchantments" in this.raw) {
                // @ts-ignore
                for (const ench of this.raw.enchantments) {
                    yield [ench.type, ench.level];
                }
                return;
            }

            for (const ench of this.raw.getEnchantments()) {
                yield [ench.type as EnchantmentType, ench.level];
            }
        }
    }

    public forEach(f: (value: number, key: EnchantmentType, map: ItemEnchantments) => void, thisArg?: any): void {
        const boundF = f.bind(thisArg);
        for (const [type, level] of this) {
            boundF(level, type, this);
        }
    }

    public "get"(type: EnchantmentType|string): number|undefined {
        if (this.raw) {
            // FIXME: Remove this glue code when the API is updated to 1.9.0.
            if ("enchantments" in this.raw) {
                // @ts-ignore
                const ench = this.raw.enchantments.getEnchantment(type);
                return ench ? ench.level : undefined;
            }

            const ench = this.raw.getEnchantment(type);
            return ench ? ench.level : undefined;
        }
        else {
            return undefined;
        }
    }

    public has(type: EnchantmentType|string): boolean {
        if (this.raw) {
            // FIXME: Remove this glue code when the API is updated to 1.9.0.
            if ("enchantments" in this.raw) {
                // @ts-ignore
                return this.raw.enchantments.hasEnchantment(type) > 0;
            }

            return this.raw.hasEnchantment(type);
        }
        else {
            return false;
        }
    }

    public *keys(): IterableIterator<EnchantmentType> {
        if (this.raw) {
            // FIXME: Remove this glue code when the API is updated to 1.9.0.
            if (this.raw && "enchantments" in this.raw) {
                // @ts-ignore
                for (const ench of this.raw.enchantments) {
                    yield ench.type;
                }
                return;
            }

            for (const ench of this.raw.getEnchantments()) {
                yield ench.type as EnchantmentType;
            }
        }
    }

    public "set"(type: EnchantmentType|string, level: number): this {
        if (this.raw) {
            // FIXME: Remove this glue code when the API is updated to 1.9.0.
            if ("enchantments" in this.raw) {
                // @ts-ignore
                this.raw.enchantments.addEnchantment(new MC.Enchantment(type, level));
                return this;
            }

            this.raw.addEnchantment({type, level});
            return this;
        }
        else {
            throw new TypeError("this item can have no enchantments");
        }
    }

    public *values(): IterableIterator<number> {
        if (this.raw) {
            // FIXME: Remove this glue code when the API is updated to 1.9.0.
            if (this.raw && "enchantments" in this.raw) {
                // @ts-ignore
                for (const ench of this.raw.enchantments) {
                    yield ench.level;
                }
                return;
            }

            for (const ench of this.raw.getEnchantments()) {
                yield ench.level;
            }
        }
    }

    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                                   stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc,
                                   opts: Required<I.InspectOptions>): PP.Doc {
        /* [ItemEnchantments] {
         *     "silk_touch",
         *     "unbreaking" 1 (max: 3),
         *     "efficiency" 5 (max: 5)
         * }
         */
        const prefix = stylise(PP.brackets(PP.text("ItemEnchantments")), I.TokenType.Tag);
        const elems  = [] as PP.Doc[];
        for (const [type, level] of this) {
            const docs = [] as PP.Doc[];
            docs.push(inspect(type.id));
            if (level > 1 || type.maxLevel > 1) {
                docs.push(inspect(level));
                docs.push(
                    stylise(
                        PP.parens(
                            PP.spaceCat(PP.text("max:"), PP.number(type.maxLevel))),
                        I.TokenType.Tag));
            }
            elems.push(PP.hsep(docs));
        }
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
    }
}

I.overrideInspector(
    EnchantmentType,
    function (this: EnchantmentType,
              inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
              stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc): PP.Doc {
        return PP.hsep([
            stylise(PP.brackets(PP.text("EnchantmentType")), I.TokenType.Tag),
            stylise(PP.brackets(PP.text(`max: ${this.maxLevel}`)), I.TokenType.Tag),
            inspect(this.id)
        ]);
    });
