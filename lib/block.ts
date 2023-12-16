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

export class Block extends Wrapper<MC.Block> {
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
        return new Dimension(this.raw.dimension);
    }

    public get isWaterlogged(): boolean {
        return this.raw.isWaterlogged;
    }

    public get location(): Location {
        return new Location(this.raw.location);
    }

    public get permutation(): BlockPermutation {
        return new BlockPermutation(this.raw.permutation);
    }

    public set permutation(newPerm: BlockPermutation) {
        this.raw.setPermutation(newPerm.raw);
    }

    public get type(): BlockType {
        return new BlockType(this.raw.type);
    }

    public set type(type: BlockType | string) {
        // FIXME: In the new API Block.prototype.setType accepts string
        // too. Remove this glue code when it's updated.
        if (typeof type === "string") {
            this.raw.setType(new BlockType(type).raw);
        }
        else {
            this.raw.setType(type.raw);
        }
        // new API:
        // this.raw.setType(type);
    }

    public get typeId(): string {
        return this.raw.typeId;
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
    public offset(dir: Direction, delta = 1): Block|undefined {
        const loc = this.location;
        switch (dir) {
            case Direction.Down:  loc.y -= delta; break;
            case Direction.East:  loc.x += delta; break;
            case Direction.North: loc.z -= delta; break;
            case Direction.South: loc.z += delta; break;
            case Direction.Up:    loc.y += delta; break;
            case Direction.West:  loc.x -= delta; break;
            default:
                throw new TypeError(`Invalid direction: ${dir}`);
        }
        return this.dimension.getBlock(loc);
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
    return class IsBlockEvent extends base {
        public get block(): Block {
            return new Block(this.raw.block);
        }

        public dimension(): Dimension {
            return new Dimension(this.raw.dimension);
        }
    };
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
