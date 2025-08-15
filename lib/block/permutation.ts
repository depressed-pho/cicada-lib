import { ItemBag } from "../item/bag.js";
import { ItemStack } from "../item/stack.js";
//import { LootTableManager } from "../loot-table.js";
import { BlockStates, BlockStateValue } from "./states.js";
import { BlockTags } from "./tags.js";
import { BlockType } from "./type.js";
import { Wrapper } from "../wrapper.js";
import { LiquidType } from "@minecraft/server";
import * as I from "../inspect.js";
import * as PP from "../pprint.js";
import * as MC from "@minecraft/server";

export class BlockPermutation extends Wrapper<MC.BlockPermutation> implements I.HasCustomInspection {
    #states?: BlockStates;
    #tags?: BlockTags;
    #type?: BlockType;

    /// @internal
    public constructor(rawPerm: MC.BlockPermutation);

    /// Construct a block permutation with its ID and optional states.
    public constructor(typeId: string, states?: Record<string, BlockStateValue>);

    public constructor(...args: any[]) {
        switch (args.length) {
            case 1:
                if (typeof args[0] === "string")
                    super(MC.BlockPermutation.resolve(args[0]));
                else
                    super(args[0]);
                break;

            case 2:
                super(MC.BlockPermutation.resolve(args[0], args[1]));
                break;

            default:
                throw new Error(`Wrong number of arguments: ${args.length}`);
        }
    }

    public get states(): BlockStates {
        if (!this.#states)
            this.#states = new BlockStates(this.raw);

        return this.#states;
    }

    public get tags(): BlockTags {
        if (!this.#tags)
            this.#tags = new BlockTags(this.raw);

        return this.#tags;
    }

    public get type(): BlockType {
        if (!this.#type)
            this.#type = new BlockType(this.raw.type);

        return this.#type;
    }

    public get typeId(): string {
        return this.type.id;
    }

    public canBeDestroyedByLiquidSpread(liquidType: LiquidType): boolean {
        return this.raw.canBeDestroyedByLiquidSpread(liquidType);
    }

    /** Generate loot from the block permutation as if it had been mined.
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

    public isLiquidBlocking(liquidType: LiquidType): boolean {
        return this.raw.isLiquidBlocking(liquidType);
    }

    public liquidSpreadCausesSpawn(liquidType: LiquidType): boolean {
        return this.raw.liquidSpreadCausesSpawn(liquidType);
    }

    public equals(other: BlockPermutation): boolean {
        return this.raw.matches(other.raw.type.id, other.raw.getAllStates());
    }

    public getItemStack(amount?: number): ItemStack|undefined {
        const rawStack = this.raw.getItemStack(amount);
        return rawStack ? new ItemStack(rawStack) : undefined;
    }

    /// @internal
    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                                  stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc): PP.Doc {
        const obj: any = {
            type: this.type
        };
        if (this.states.size > 0)
            obj.states = this.states;
        if (this.tags.size > 0)
            obj.tags = this.tags;
        return PP.spaceCat(
            stylise(PP.text("BlockPermutation"), I.TokenType.Class),
            inspect(obj));
    }
}
