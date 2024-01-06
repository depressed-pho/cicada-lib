import { map } from "../iterable.js";
import { Wrapper } from "../wrapper.js";
import * as MC from "@minecraft/server";

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
            const rawBt = MC.BlockTypes.get(arg0);
            if (rawBt)
                super(rawBt);
            else
                throw new Error(`No such block ID exists: ${arg0}`);
        }
    }

    public get canBeWaterlogged(): boolean {
        return this.raw.canBeWaterlogged;
    }

    public get id(): string {
        return this.raw.id;
    }

    /** Obtain all available block types registered within the world. */
    public static getAll(): IterableIterator<BlockType> {
        return map(MC.BlockTypes.getAll(), raw => {
            return new BlockType(raw);
        });
    }
}
