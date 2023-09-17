// The enum Direction is missing from @minecraft/server 1.3.0 for some
// reason. We can't import it, or it will result in a run-time error.
//import { Direction } from "@minecraft/server";
//export { Direction }

export enum Direction {
    /**
     * Represents an object located or facing in the down (z - 1)
     * direction.
     */
    Down = "Down",
    /**
     * Represents an object located or facing in the east (x + 1)
     * direction.
     */
    East = "East",
    /**
     * Represents an object located or facing in the north (z - 1)
     * direction.
     */
    North = "North",
    /**
     * Represents an object located or facing in the south (z + 1)
     * direction.
     */
    South = "South",
    /**
     * Represents an object located or facing in the up (z + 1)
     * direction.
     */
    Up = "Up",
    /**
     * Represents an object located or facing in the west (x - 1)
     * direction.
     */
    West = "West",
}
