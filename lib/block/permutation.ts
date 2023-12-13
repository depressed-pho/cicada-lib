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
}
