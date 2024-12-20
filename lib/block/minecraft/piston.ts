import { map } from "../../iterable.js";
import { Block } from "../../block.js";
import { Wrapper } from "../../wrapper.js";
import { Faced } from "../faced.js";
import { BlockPistonState } from "@minecraft/server";
import * as MC from "@minecraft/server";

export { BlockPistonState };

export class Piston extends Faced(Block) {
    readonly #piston: MC.BlockPistonComponent;

    /** Upcast a Block object representing `minecraft:piston`. */
    public constructor(...args: ConstructorParameters<typeof Block>) {
        super(...args);
        this.#piston =
            this.getComponentOrThrow(MC.BlockPistonComponent.componentId);
    }

    public get isMoving(): boolean {
        return this.#piston.isMoving;
    }

    public get state(): BlockPistonState {
        return this.#piston.state;
    }

    public get attachedBlocks(): IterableIterator<Block> {
        return map(this.#piston.getAttachedBlocks(), (pos: MC.Vector3) => {
            return this.dimension.getBlock(pos)!;
        });
    }
}

export class PistonActivateAfterEvent extends Wrapper<MC.PistonActivateAfterEvent> {
    readonly isExpanding: boolean;
    readonly piston: Piston;

    /// Package private
    public constructor(rawEv: MC.PistonActivateAfterEvent) {
        super(rawEv);
        // Every field of MC.PistonActivateAfterEvent becomes undefined
        // after the event handler returns. We must copy them now.
        // THINKME: That sounds like a game bug. Is that still the case?
        this.isExpanding = rawEv.isExpanding;
        this.piston      = new Piston(rawEv.piston.block);
    }
}
