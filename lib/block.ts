import { Dimension } from "./dimension.js";
import { Location } from "./location.js";
import { map } from "./iterable.js";
import { Player } from "./player.js";
import { Wrapper } from "./wrapper.js";
import { Direction } from "@minecraft/server";
import * as MC from "@minecraft/server";

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

    public get type(): BlockType {
        return new BlockType(this.raw.type);
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
            case Direction.down:  loc.y -= delta; break;
            case Direction.east:  loc.x += delta; break;
            case Direction.north: loc.z -= delta; break;
            case Direction.south: loc.z += delta; break;
            case Direction.up:    loc.y += delta; break;
            case Direction.west:  loc.x -= delta; break;
            default:
                throw new TypeError(`Invalid direction: ${dir}`);
        }
        return this.dimension.getBlock(loc);
    }

    /** Package private */
    public getComponentOrThrow<T>(componentId: string): T {
        const c = this.raw.getComponent(componentId);
        if (c) {
            return c as T;
        }
        else {
            throw new TypeError(`The block does not have a component \`${componentId}'`);;
        }
    }
}

export class BlockPermutation extends Wrapper<MC.BlockPermutation> {
    public get type(): BlockType {
        return new BlockType(this.raw.type);
    }

    public get states(): BlockStates {
        return new BlockStates(this.raw.getAllStates());
    }
}

export type BlockStateValue = boolean|number|string;

/** A read-only Map type that represents block permutation states. */
export class BlockStates extends Wrapper<Record<string, BlockStateValue>> implements Iterable<[string, BlockStateValue]> {
    public constructor(states: Record<string, BlockStateValue>) {
        super(states);
    }

    public get size(): number {
        return Object.keys(this.raw).length;
    }

    public [Symbol.iterator](): IterableIterator<[string, BlockStateValue]> {
        return this.entries();
    }

    public *entries(): IterableIterator<[string, BlockStateValue]> {
        for (const key in this.raw) {
            yield [key, this.raw[key]!];
        }
    }

    public forEach(f: (value: BlockStateValue, key: string, map: BlockStates) => void, thisArg?: any): void {
        const boundF = f.bind(thisArg);
        for (const [key, value] of this) {
            boundF(value, key, this);
        }
    }

    public get(key: string): BlockStateValue|undefined {
        return this.raw[key];
    }

    public has(key: string): boolean {
        return key in this.raw;
    }

    public *keys(): IterableIterator<string> {
        for (const key in this.raw) {
            yield key;
        }
    }

    public *values(): IterableIterator<BlockStateValue> {
        for (const key in this.raw) {
            yield this.raw[key]!;
        }
    }
}

export class BlockType extends Wrapper<MC.BlockType> {
    /** Package private */
    public constructor(rawBlockType: MC.BlockType);

    /** Construct a block type. */
    public constructor(typeId: string);

    public constructor(arg0: MC.BlockType|string) {
        if (arg0 instanceof MC.BlockType) {
            super(arg0);
        }
        else {
            super(MC.MinecraftBlockTypes.get(arg0));
        }
    }

    public get canBeWaterlogged(): boolean {
        return this.raw.canBeWaterlogged;
    }

    public get id(): string {
        return this.raw.id;
    }

    public static getAllBlockTypes(): IterableIterator<BlockType> {
        // Create an iterable object that progressively constructs
        // BlockType.
        return map(MC.MinecraftBlockTypes.getAllBlockTypes(), raw => {
            return new BlockType(raw);
        });
    }

}

export interface BlockPlaceAfterEvent {
    readonly block:     Block;
    readonly dimension: Dimension;
    readonly player:    Player;
}

export interface BlockBreakAfterEvent {
    readonly block:                  Block;
    readonly brokenBlockPermutation: BlockPermutation;
    readonly dimension:              Dimension;
    readonly player:                 Player;
}
