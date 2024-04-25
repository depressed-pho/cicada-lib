import { EnchantmentType } from "@minecraft/server";
import * as I from "../inspect.js";
import * as PP from "../pprint.js";
import * as MC from "@minecraft/server";

export { EnchantmentType };

export class ItemEnchantments implements Map<EnchantmentType, number>, I.HasCustomInspection {
    /// @internal
    readonly raw: MC.ItemEnchantableComponent|undefined;

    public static readonly typeId = "minecraft:enchantable";

    public static "type"(enchantmentId: string): EnchantmentType|undefined {
        return MC.EnchantmentTypes.get(enchantmentId);
    }

    /// @internal
    public constructor(raw: MC.ItemEnchantableComponent|undefined) {
        this.raw = raw;
    }

    public get size(): number {
        return this.raw ? this.raw.getEnchantments().length : 0;
    }

    public get [Symbol.toStringTag](): string {
        return "ItemEnchantments";
    }

    public [Symbol.iterator](): IterableIterator<[EnchantmentType, number]> {
        return this.entries();
    }

    public canSet(type: EnchantmentType|string, level: number): boolean {
        return this.raw
            ? this.raw.canAddEnchantment({
                  type: typeof type === "string"
                        ? new EnchantmentType(type) : type,
                  level
              })
            : false;
    }

    public clear(): void {
        if (this.raw) {
            this.raw.removeAllEnchantments();
        }
    }

    public delete(type: EnchantmentType|string): boolean {
        if (this.has(type)) {
            this.raw!.removeEnchantment(type);
            return true;
        }
        else {
            return false;
        }
    }

    public *entries(): IterableIterator<[EnchantmentType, number]> {
        if (this.raw) {
            for (const ench of this.raw.getEnchantments()) {
                yield [ench.type, ench.level];
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
            const ench = this.raw.getEnchantment(type);
            return ench ? ench.level : undefined;
        }
        else {
            return undefined;
        }
    }

    public has(type: EnchantmentType|string): boolean {
        if (this.raw) {
            return this.raw.hasEnchantment(type);
        }
        else {
            return false;
        }
    }

    public *keys(): IterableIterator<EnchantmentType> {
        if (this.raw) {
            for (const ench of this.raw.getEnchantments()) {
                yield ench.type;
            }
        }
    }

    public "set"(type: EnchantmentType|string, level: number): this {
        if (this.raw) {
            this.raw.addEnchantment({
                type: typeof type === "string"
                      ? new EnchantmentType(type) : type,
                level
            });
            return this;
        }
        else {
            throw new TypeError("this item can have no enchantments");
        }
    }

    public *values(): IterableIterator<number> {
        if (this.raw) {
            for (const ench of this.raw.getEnchantments()) {
                yield ench.level;
            }
        }
    }

    /// @internal
    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                                   stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc,
                                   opts: Required<I.InspectOptions>): PP.Doc {
        /* [ItemEnchantments] {
         *     "silk_touch",
         *     "unbreaking" 1 (max: 3),
         *     "efficiency" 5 (max: 5)
         * }
         */
        const prefix = stylise(PP.text("ItemEnchantments"), I.TokenType.Class);
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
