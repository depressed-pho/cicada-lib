import { Dimension } from "./dimension.js";
import { Location } from "./location.js";
import { map } from "./iterable.js";
import { Player } from "./player.js";
import * as MC from "@minecraft/server";

export class Block {
    readonly #block: MC.Block;

    /** Clone an existing instance. */
    public constructor(block: Block);

    /** The signature is public only because of a language limitation. User
     * code must never use it directly. */
    public constructor(rawBlock: MC.Block);

    public constructor(arg: Block|MC.Block) {
        if (arg instanceof Block) {
            this.#block = arg.#block;
        }
        else {
            this.#block = arg;
        }
    }

    public get dimension(): Dimension {
        return new Dimension(this.#block.dimension);
    }

    public get isWaterlogged(): boolean {
        return this.#block.isWaterlogged;
    }

    public get location(): Location {
        return new Location(this.#block.location);
    }

    public get permutation(): BlockPermutation {
        return new BlockPermutation(this.#block.permutation);
    }

    public get type(): BlockType {
        return new BlockType(this.#block.type);
    }

    public get typeId(): string {
        return this.#block.typeId;
    }

    public get x(): number {
        return this.#block.x;
    }

    public get y(): number {
        return this.#block.y;
    }

    public get z(): number {
        return this.#block.z;
    }

    /** Package private */
    public getComponentOrThrow<T>(componentId: string): T {
        const c = this.#block.getComponent(componentId);
        if (c) {
            return c as T;
        }
        else {
            throw new TypeError(`The block does not have a component \`${componentId}'`);;
        }
    }
}

export class BlockPermutation {
    readonly #perm: MC.BlockPermutation;

    /** Package private */
    public constructor(rawPerm: MC.BlockPermutation) {
        this.#perm = rawPerm;
    }

    /** Package private */
    public get raw(): MC.BlockPermutation {
        return this.#perm;
    }

    public get type(): BlockType {
        return new BlockType(this.#perm.type);
    }

    public get states(): BlockStates {
        return new BlockStates(this.#perm.getAllProperties());
    }
}

export type BlockStateValue = boolean|number|string;

/** A read-only Map type that represents block permutation states. */
export class BlockStates implements Iterable<[string, BlockStateValue]> {
    readonly #states: Record<string, BlockStateValue>;

    public constructor(states: Record<string, BlockStateValue>) {
        this.#states = states;
    }

    public get size(): number {
        return Object.keys(this.#states).length;
    }

    public [Symbol.iterator](): IterableIterator<[string, BlockStateValue]> {
        return this.entries();
    }

    public *entries(): IterableIterator<[string, BlockStateValue]> {
        for (const key in this.#states) {
            yield [key, this.#states[key]!];
        }
    }

    public forEach(f: (value: BlockStateValue, key: string, map: BlockStates) => void, thisArg?: any): void {
        const boundF = f.bind(thisArg);
        for (const [key, value] of this) {
            boundF(value, key, this);
        }
    }

    public get(key: string): BlockStateValue|undefined {
        return this.#states[key];
    }

    public has(key: string): boolean {
        return key in this.#states;
    }

    public *keys(): IterableIterator<string> {
        for (const key in this.#states) {
            yield key;
        }
    }

    public *values(): IterableIterator<BlockStateValue> {
        for (const key in this.#states) {
            yield this.#states[key]!;
        }
    }
}

export class BlockType {
    readonly #type: MC.BlockType;

    /** Package private */
    public constructor(rawBlockType: MC.BlockType);

    /** Construct a block type. */
    public constructor(typeId: string);

    public constructor(arg0: MC.BlockType|string) {
        if (arg0 instanceof MC.BlockType) {
            this.#type = arg0;
        }
        else {
            this.#type = MC.MinecraftBlockTypes.get(arg0);
        }
    }

    public get canBeWaterlogged(): boolean {
        return this.#type.canBeWaterlogged;
    }

    public get id(): string {
        return this.#type.id;
    }

    public static getAllBlockTypes(): IterableIterator<BlockType> {
        // Create an iterable object that progressively constructs
        // BlockType.
        return map(MC.MinecraftBlockTypes.getAllBlockTypes(), raw => {
            return new BlockType(raw);
        });
    }

}

export interface BlockPlaceEvent {
    readonly block:     Block;
    readonly dimension: Dimension;
    readonly player:    Player;
}

export interface BlockBreakEvent {
    readonly block:                  Block;
    readonly brokenBlockPermutation: BlockPermutation;
    readonly dimension:              Dimension;
    readonly player:                 Player;
}
