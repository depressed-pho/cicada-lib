import { BlockInventory } from "./block/inventory.js";
import { BlockPermutation } from "./block/permutation.js";
import { BlockTags } from "./block/tags.js";
import { BlockType } from "./block/type.js";
import { Dimension } from "./dimension.js";
import { ItemBag } from "./item/bag.js";
import { ItemStack } from "./item/stack.js";
import { Location } from "./location.js";
//import { LootTableManager } from "./loot-table.js";
import { Constructor } from "./mixin.js";
import { Player } from "./player.js";
import { Wrapper } from "./wrapper.js";
import { Direction, LiquidType, Vector3 } from "@minecraft/server";
import * as I from "./inspect.js";
import * as PP from "./pprint.js";
import * as MC from "@minecraft/server";

export { BlockPermutation, BlockTags, BlockType, LiquidType };
export { BlockStateValue, BlockStates } from "./block/states.js";

export class Block extends Wrapper<MC.Block> {
    #dimension?: Dimension;
    #location?: Location;
    #tags?: BlockTags;

    public get dimension(): Dimension {
        if (!this.#dimension)
            this.#dimension = new Dimension(this.raw.dimension);

        return this.#dimension;
    }

    public get inventory(): BlockInventory|undefined {
        if (this.#inventory === undefined) {
            const raw = this.raw.getComponent(BlockInventory.typeId);
            this.#inventory = raw ? new BlockInventory(raw) : null;
        }
        return this.#inventory ?? undefined;
    }
    #inventory?: BlockInventory|null;

    public get isAir(): boolean {
        return this.raw.isAir;
    }

    public get isLiquid(): boolean {
        return this.raw.isLiquid;
    }

    public get isSolid(): boolean {
        throw new Error("FIXME: Block.property.isSolid is currently not available in the stable API");
    }

    public get isValid(): boolean {
        return this.raw.isValid;
    }

    public get isWaterlogged(): boolean {
        return this.raw.isWaterlogged;
    }

    public set isWaterlogged(waterlogged: boolean) {
        this.raw.setWaterlogged(waterlogged);
    }

    public get location(): Location {
        if (!this.#location)
            this.#location = new Location(this.raw.location);

        return this.#location;
    }

    public get permutation(): BlockPermutation {
        // Can't cache the permutation because it might be stale.
        return new BlockPermutation(this.raw.permutation);
    }

    public set permutation(newPerm: BlockPermutation) {
        this.raw.setPermutation(newPerm.raw);
    }

    public get redstonePower(): number|undefined {
        return this.raw.getRedstonePower();
    }

    public get tags(): BlockTags {
        // We can cache this because BlockTags does not hold a copy.
        if (!this.#tags)
            this.#tags = new BlockTags(this.raw);

        return this.#tags;
    }

    public get type(): BlockType {
        // Can't cache the block type because it might be stale.
        return new BlockType(this.raw.type);
    }

    public set type(blockType: BlockType) {
        this.raw.setType(blockType);
    }

    public get typeId(): string {
        return this.raw.typeId;
    }

    public set typeId(typeId: string) {
        this.raw.setType(typeId);
    }

    public get x(): number {
        return this.raw.x;
    }

    public get y(): number {
        return this.raw.y;
    }

    public get z(): number {
        return this.raw.z;
    }

    public canBeDestroyedByLiquidSpread(liquidType: LiquidType): boolean {
        return this.raw.canBeDestroyedByLiquidSpread(liquidType);
    }

    public canContainLiquid(liquidType: LiquidType): boolean {
        return this.raw.canContainLiquid(liquidType);
    }

    /** Generate loot from the block as if it had been mined. This method
     * generates loot from the current permutation and the current set of
     * block components of this specific block in the dimension.
     *
     * Use {@link BlockPermutation.prototype.generateLoot} if you want to
     * simulate the loot table based on the default components for a
     * particular block permutation. Or use {@link
     * BlockType.prototype.generateLoot} if you want to simulate the loot
     * table for the default permutation of a block type.
     *
     * @param tool
     * Optional. The tool to use in the looting operation.
     *
     * @returns
     * A bag of items dropped from the loot drop event. Can be empty if no
     * loot dropped, or `null` if the provided tool is insufficient to mine
     * the block.
     *
     * @throws
     * Throws if the Block object does not reference a valid block.
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

    public liquidCanFlowFromDirection(liquidType: LiquidType, flowDirection: Direction): boolean {
        return this.raw.liquidCanFlowFromDirection(liquidType, flowDirection);
    }

    /// Get another block at a given offset towards a given direction.
    public offset(dir: Direction, delta?: number): Block|undefined;

    /// Get another block with given offsets for each axis.
    public offset(x: number, y: number, z: number): Block|undefined;

    public offset(...args: any[]): Block|undefined {
        switch (args.length) {
            case 1:
            case 2:
                const d = args[1] ?? 1;
                switch (args[0]) {
                    case Direction.Down:  return this.offset( 0, -d,  0);
                    case Direction.East:  return this.offset( d,  0,  0);
                    case Direction.North: return this.offset( 0,  0, -d);
                    case Direction.South: return this.offset( 0,  0,  d);
                    case Direction.Up:    return this.offset( 0,  d,  0);
                    case Direction.West:  return this.offset(-d,  0,  0);
                    default:
                        throw new TypeError(`Invalid direction: ${args[0]}`);
                }
            case 3:
                return this.dimension.getBlock(
                    this.location.offset(args[0], args[1], args[2]));
            default:
                throw new Error("impossible");
        }
    }

    /** Package private */
    public getComponentOrThrow<T extends keyof MC.BlockComponentTypeMap>(componentId: T): MC.BlockComponentReturnType<T> {
        const c = this.raw.getComponent(componentId);
        if (c) {
            return c;
        }
        else {
            throw new TypeError(`The block does not have a component \`${componentId}'`);;
        }
    }

    public getItemStack(amount?: number, withData?: boolean): ItemStack | undefined {
        const rawSt = this.raw.getItemStack(amount, withData);
        return rawSt ? new ItemStack(rawSt) : undefined;
    }

    // A workaround for a possible TypeScript bug: Using
    // I.customInspectSymbol here causes mixins to fail typechecking,
    // apparently because it's a unique
    // symbol. https://github.com/microsoft/TypeScript/issues/57165
    /// @internal
    public [Symbol.for("cicada-lib.inspect")](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                                              stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc): PP.Doc {
        const obj: any = {
            dimension: this.dimension,
            location: this.location,
            permutation: this.permutation,
            isAir: this.isAir,
            isLiquid: this.isLiquid,
            //isSolid: this.isSolid, // FIXME: uncomment this when isSolid is released
        };
        if (this.canContainLiquid(LiquidType.Water)) {
            obj.isWaterlogged = this.isWaterlogged;
        }
        // THINKME: What about other liquid-related properties? Are they
        // worth reporting? (Yes they are!)
        if (this.redstonePower !== undefined)
            obj.redstonePower = this.redstonePower;

        // NOTE: The class Block doesn't have getComponents() for some
        // reason. We can only inspect components known to us.
        const comps = new Set<any>();
        if (this.inventory)
            comps.add(this.inventory);
        if (comps.size > 0)
            obj.components = comps;

        return PP.spaceCat(
            stylise(PP.text("Block"), I.TokenType.Class),
            inspect(obj));
    }
}

export interface BlockRaycastHit {
    readonly block:        Block;
    readonly face:         Direction;
    readonly faceLocation: Vector3;
}

export interface BlockEvent {
    readonly block:     Block;
    readonly dimension: Dimension;
}

function IsBlockEvent<T extends Constructor<Wrapper<MC.BlockEvent>>>(base: T) {
    abstract class IsBlockEvent extends base {
        public get block(): Block {
            return new Block(this.raw.block);
        }

        public dimension(): Dimension {
            return new Dimension(this.raw.dimension);
        }
    }
    return IsBlockEvent;
}

export class PlayerBreakBlockBeforeEvent extends IsBlockEvent(Wrapper<MC.PlayerBreakBlockBeforeEvent>) {
    public cancel() {
        this.raw.cancel = true;
    }

    /** The item stack that is being used to break the block, or undefined
     * if empty hand. Note that the returned object is only a copy of the
     * item the player is using. It does not reflect future state changes,
     * and mutating it has no effects on the original stack even after
     * leaving the read-only mode.
     */
    public get itemStack(): ItemStack|undefined {
        return this.raw.itemStack
            ? new ItemStack(this.raw.itemStack)
            : undefined;
    }

    public set itemStack(st: ItemStack|undefined) {
        // @ts-ignore: Override exactOptionalPropertyTypes
        this.raw.itemStack = st ? st.raw : undefined;
    }

    public get player(): Player {
        return new Player(this.raw.player);
    }
}

export interface PlayerBreakBlockAfterEvent extends BlockEvent {
    readonly brokenBlockPermutation: BlockPermutation;
    readonly itemStackAfterBreak?:   ItemStack;
    readonly itemStackBeforeBreak?:  ItemStack
    readonly player:                 Player;
}

export interface PlayerPlaceBlockAfterEvent extends BlockEvent {
    readonly player: Player;
}
