import { map } from "./iterable.js";
import * as MC from "@minecraft/server";

export class Location {
    readonly #location: MC.Location;

    /** This overload is public only because of a language limitation. User
     * code must never call it directly. */
    public constructor(rawLocation: MC.Location);

    /** Construct a Location object from a BlockLocation. */
    public constructor(blockLocation: BlockLocation);

    /** Construct an object describing decimal locations of things like
     * entities. */
    public constructor(x: number, y: number, z: number);

    public constructor(...args: any[]) {
        switch (args.length) {
            case 1:
                if (args[0] instanceof BlockLocation) {
                    const bl = args[0];
                    this.#location = new MC.Location(bl.x, bl.y, bl.z);
                }
                else {
                    this.#location = args[0];
                }
                break;
            case 3:
                this.#location = new MC.Location(args[0], args[1], args[2]);
                break;
            default:
                throw new Error("internal error");
        }
    }

    /** Package private: user code should not use this. */
    public get raw(): MC.Location {
        return this.#location;
    }

    public get x(): number {
        return this.#location.x;
    }
    public set x(pos: number) {
        this.#location.x = pos;
    }

    public get y(): number {
        return this.#location.y;
    }
    public set y(pos: number) {
        this.#location.y = pos;
    }

    public get z(): number {
        return this.#location.z;
    }
    public set z(pos: number) {
        this.#location.z = pos;
    }

    public clone(): Location {
        return new Location(this.x, this.y, this.z);
    }

    public equals(other: Location): boolean {
        return this.#location.equals(other.raw)
    }

    public isNear(other: Location, epsilon: number): boolean {
        return this.#location.isNear(other.raw, epsilon);
    }

    public offset(x: number, y: number, z: number): Location {
        const clone = this.clone();
        clone.x += x;
        clone.y += y;
        clone.z += z;
        return clone;
    }

    public toString(): string {
        return `${this.x}, ${this.y}, ${this.z}`;
    }
}

export class BlockLocation {
    readonly #location: MC.BlockLocation;

    /** This overload is public only because of a language limitation. User
     * code must never call it directly. */
    public constructor(rawLocation: MC.BlockLocation);

    /** Construct an object describing integral locations of blocks. */
    public constructor(x: number, y: number, z: number);

    public constructor(...args: any[]) {
        switch (args.length) {
            case 1:
                this.#location = args[0];
                break;
            case 3:
                this.#location = new MC.BlockLocation(args[0], args[1], args[2]);
                break;
            default:
                throw new Error("internal error");
        }
    }

    /** Package private: user code should not use this. */
    public get raw(): MC.BlockLocation {
        return this.#location;
    }

    public get x(): number {
        return this.#location.x;
    }
    public set x(pos: number) {
        this.#location.x = pos;
    }

    public get y(): number {
        return this.#location.y;
    }
    public set y(pos: number) {
        this.#location.y = pos;
    }

    public get z(): number {
        return this.#location.z;
    }
    public set z(pos: number) {
        this.#location.z = pos;
    }

    public clone(): BlockLocation {
        return new BlockLocation(this.x, this.y, this.z);
    }

    public above(): BlockLocation {
        return new BlockLocation(this.#location.above());
    }

    public blocksBetween(other: BlockLocation): Iterable<BlockLocation> {
        // Create an iterable object that progressively constructs BlockLocation.
        return map(this.#location.blocksBetween(other.raw), raw => {
            return new BlockLocation(raw);
        });
    }

    public equals(other: BlockLocation): boolean {
        return this.#location.equals(other.raw);
    }

    public offset(x: number, y: number, z: number): BlockLocation {
        return new BlockLocation(this.#location.offset(x, y, z));
    }

    public toString(): string {
        return `${this.x}, ${this.y}, ${this.z}`;
    }
}
