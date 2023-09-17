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
                    return Direction.down;
                case 1:
                    return Direction.up;
                case 2:
                    return Direction.south;
                case 3:
                    return Direction.north;
                case 4:
                    return Direction.east;
                case 5:
                    return Direction.west;
                case undefined:
                    throw new TypeError("The block permutation does not have a state `facing_direction'");
                default:
                    throw new TypeError(`Unknown direction: ${rawDir}`);
            }
        }
    };
}
