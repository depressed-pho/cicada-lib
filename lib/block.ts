import { Dimension } from "./dimension.js";
import { Location } from "./location.js";
import { map } from "./iterable.js";
import { Player } from "./player.js";
import * as MC from "@minecraft/server";

export class Block {
    readonly #block: MC.Block;

    /** The constructor is public only because of a language
     * limitation. User code must never call it directly. */
    public constructor(rawBlock: MC.Block) {
        this.#block = rawBlock;
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

    public static getAllBlockTypes(): Iterable<BlockType> {
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
