import { ItemStack } from "../item/stack.js";
import { BlockStates, BlockStateValue } from "./states.js";
import { BlockTags } from "./tags.js";
import { BlockType } from "./type.js";
import { Wrapper } from "../wrapper.js";
import * as MC from "@minecraft/server";

export class BlockPermutation extends Wrapper<MC.BlockPermutation> {
    #states?: BlockStates;
    #tags?: BlockTags;
    #type?: BlockType;

    /// Package private: user code should not use this.
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

    public equals(other: BlockPermutation): boolean {
        return this.raw.matches(other.raw.type.id, other.raw.getAllStates());
    }

    public getItemStack(amount?: number): ItemStack|undefined {
        const rawStack = this.raw.getItemStack(amount);
        return rawStack ? new ItemStack(rawStack) : undefined;
    }
}
