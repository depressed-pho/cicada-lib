import * as MC from "@minecraft/server";

export class Location implements MC.Vector3 {
    x: number;
    y: number;
    z: number;

    /** Construct a Location object from a Vector3. */
    public constructor(vec3: MC.Vector3);

    /** Construct an object describing decimal locations of things like
     * entities. */
    public constructor(x: number, y: number, z: number);

    public constructor(...args: any[]) {
        switch (args.length) {
            case 1:
                this.x = args[0].x;
                this.y = args[0].y;
                this.z = args[0].z;
                break;
            case 3:
                this.x = args[0];
                this.y = args[1];
                this.z = args[2];
                break;
            default:
                throw new Error("internal error");
        }
    }

    public clone(): Location {
        return new Location(this.x, this.y, this.z);
    }

    public equals(other: Location): boolean {
        return this.x == other.x &&
               this.y == other.y &&
               this.z == other.z;
    }

    public floor(): Location {
        return new Location(
            Math.floor(this.x),
            Math.floor(this.y),
            Math.floor(this.z));
    }

    public distance(other: Location): number {
        return Math.sqrt(
                 Math.pow(this.x - other.x, 2) +
                 Math.pow(this.y - other.y, 2) +
                 Math.pow(this.z - other.z, 2));
    }

    public isNear(other: Location, epsilon: number): boolean {
        return this.distance(other) <= epsilon;
    }

    public offset(delta: number): Location;
    public offset(x: number, y: number, z: number): Location;
    public offset(...args: any[]) {
        const clone = this.clone();
        if (args.length == 3) {
            clone.x += args[0];
            clone.y += args[1];
            clone.z += args[2];
        }
        else {
            clone.x += args[0];
            clone.y += args[0];
            clone.z += args[0];
        }
        return clone;
    }

    public toString(): string {
        return `${this.x}, ${this.y}, ${this.z}`;
    }
}
