import { BlockPermutation } from "./block/permutation.js";
import { BlockType } from "./block/type.js";
import { Dimension } from "./dimension.js";
import { Location } from "./location.js";
import { Constructor } from "./mixin.js";
import { ItemStack } from "./item/stack.js";
import { Player } from "./player.js";
import { Wrapper } from "./wrapper.js";
import { Direction, Vector3 } from "@minecraft/server";
import * as MC from "@minecraft/server";

export { BlockPermutation, BlockType };
export { BlockStateValue, BlockStates } from "./block/states.js";
export { BlockTags } from "./block/tags.js";

export class Block extends Wrapper<MC.Block> {
    #dimension?: Dimension;
    #location?: Location;

    /** Clone an existing instance. */
    public constructor(block: Block);

    /** The signature is public only because of a language limitation. User
     * code must never use it directly. */
    public constructor(rawBlock: MC.Block);

    public constructor(arg: Block|MC.Block) {
        if (arg instanceof Block) {
            super(arg.raw);
        }
        else {
            super(arg);
        }
    }

    public get dimension(): Dimension {
        if (!this.#dimension)
            this.#dimension = new Dimension(this.raw.dimension);

        return this.#dimension;
    }

    public get isValid(): boolean {
        return this.raw.isValid();
    }

    public get isWaterlogged(): boolean {
        return this.raw.isWaterlogged;
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
    public getComponentOrThrow<T extends keyof MC.BlockComponentTypeMap>(componentId: T): MC.BlockComponentTypeMap[T] {
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
    /// Package private
    public constructor(rawEv: MC.PlayerBreakBlockBeforeEvent) {
        super(rawEv);
    }

    public cancel() {
        this.raw.cancel = true;
    }

    public get itemStack(): ItemStack|undefined {
        return this.raw.itemStack ? new ItemStack(this.raw.itemStack) : undefined;
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
