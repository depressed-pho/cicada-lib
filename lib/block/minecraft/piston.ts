import { map } from "../../iterable.js";
import { Block } from "../../block.js";
import { Wrapper } from "../../wrapper.js";
import { Faced } from "../faced.js";
// FIXME: This enum does not exist in 1.8.0-beta yet
// import { BlockPistonState } from "@minecraft/server";
import * as MC from "@minecraft/server";

export { BlockPistonState };

// FIXME: Remove this later.
enum BlockPistonState {
    Expanded = 'Expanded',
    Expanding = 'Expanding',
    Retracted = 'Retracted',
    Retracting = 'Retracting',
}

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
