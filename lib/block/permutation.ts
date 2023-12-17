import { ItemStack } from "../item/stack.js";
import { BlockStates } from "./states.js";
import { BlockTags } from "./tags.js";
import { BlockType } from "./type.js";
import { Wrapper } from "../wrapper.js";
import * as MC from "@minecraft/server";

export class BlockPermutation extends Wrapper<MC.BlockPermutation> {
    #states?: BlockStates;
    #tags?: BlockTags;
    #type?: BlockType;

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

    public equals(other: BlockPermutation): boolean {
        return this.raw.matches(other.raw.type.id, other.raw.getAllStates());
    }

    public getItemStack(amount?: number): ItemStack|undefined {
        const rawStack = this.raw.getItemStack(amount);
        return rawStack ? new ItemStack(rawStack) : undefined;
    }
}
