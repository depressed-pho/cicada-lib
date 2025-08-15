import { ItemBag } from "../item/bag.js";
import { ItemStack } from "../item/stack.js";
import { map } from "../iterable.js";
//import { LootTableManager } from "../loot-table.js";
import { Wrapper } from "../wrapper.js";
import * as I from "../inspect.js";
import * as PP from "../pprint.js";
import * as MC from "@minecraft/server";

export class BlockType extends Wrapper<MC.BlockType> implements I.HasCustomInspection {
    /** Obtain all available block types registered within the world. */
    public static getAll(): IterableIterator<BlockType> {
        return map(MC.BlockTypes.getAll(), raw => {
            return new BlockType(raw);
        });
    }

    /// @internal
    public constructor(rawBlockType: MC.BlockType);

    /** Construct a block type. */
    public constructor(typeId: string);

    public constructor(arg0: MC.BlockType|string) {
        if (arg0 instanceof MC.BlockType) {
            super(arg0);
        }
        else {
            const rawBT = MC.BlockTypes.get(arg0);
            if (rawBT)
                super(rawBT);
            else
                throw new Error(`No such block ID exists: ${arg0}`);
        }
    }

    public get id(): string {
        return this.raw.id;
    }

    /** Generate loot from the default permutation of this block type as if
     * it had been mined.
     *
     * @param tool
     * Optional. The tool to use in the looting operation.
     *
     * @returns
     * A bag of items dropped from the loot drop event. Can be empty if no
     * loot dropped, or `null` if the provided tool is insufficient to mine
     * the block.
     */
    public generateLoot(_tool?: ItemStack): ItemBag|null {
        //return LootTableManager.instance.generateLoot(this, tool)!;
        throw new Error("FIXME: LootTableManager is currently unavailable in the stable API");
    }

    /// @internal
    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                                  stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc): PP.Doc {
        const obj: any = {
            id: this.id
        };
        return PP.spaceCat(
            stylise(PP.text("BlockType"), I.TokenType.Class),
            inspect(obj));
    }
}
