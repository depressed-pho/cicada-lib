import { Block } from "../block.js";
import { Constructor } from "../mixin.js";
import { Direction } from "@minecraft/server";

export { Direction };

/** A mixin for blocks that have a state `facing_direction`. */
export function Faced<T extends Constructor<Block>>(base: T) {
    return class Faced extends base {
        public get facingDirection(): Direction {
            // See https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockstateslist
            const rawDir = this.permutation.states.get("facing_direction");
            switch (rawDir) {
                case 0:
                    return Direction.Down;
                case 1:
                    return Direction.Up;
                case 2:
                    return Direction.South;
                case 3:
                    return Direction.North;
                case 4:
                    return Direction.East;
                case 5:
                    return Direction.West;
                case undefined:
                    throw new TypeError("The block permutation does not have a state `facing_direction'");
                default:
                    throw new TypeError(`Unknown direction: ${rawDir}`);
            }
        }
    };
}
