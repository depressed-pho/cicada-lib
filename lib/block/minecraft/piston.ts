import { map } from "../../iterable.js";
import { Block } from "../../block.js";
import { Wrapper } from "../../wrapper.js";
import { Faced } from "../faced.js";
import * as MC from "@minecraft/server";

export class Piston extends Faced(Block) {
    readonly #piston: MC.BlockPistonComponent;

    /** Upcast a Block object representing `minecraft:piston`. */
    public constructor(...args: ConstructorParameters<typeof Block>) {
        super(...args);
        this.#piston =
            this.getComponentOrThrow(MC.BlockPistonComponent.componentId);
    }

    public get isExpanded(): boolean {
        return this.#piston.isExpanded;
    }

    public get isExpanding(): boolean {
        return this.#piston.isExpanding;
    }

    public get isMoving(): boolean {
        return this.#piston.isMoving;
    }

    public get isRetracted(): boolean {
        return this.#piston.isRetracted;
    }

    public get isRetracting(): boolean {
        return this.#piston.isRetracting;
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
        this.isExpanding = rawEv.isExpanding;
        this.piston      = new Piston(rawEv.piston.block);
    }
}

export class PistonActivateBeforeEvent extends PistonActivateAfterEvent {
    /// Package private
    public constructor(rawEv: MC.PistonActivateBeforeEvent) {
        super(rawEv);
    }

    public cancel(): void {
        // NOTE: We cannot simply override "get raw()" due to
        // https://github.com/microsoft/TypeScript/issues/41347
        (super.raw as MC.PistonActivateBeforeEvent).cancel = true;
    }
}
