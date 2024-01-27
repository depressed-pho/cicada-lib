import { Entity } from "../entity.js";
import { Location } from "../location.js";
import { Wrapper } from "../wrapper.js";
import { fromIterable, map } from "../iterable.js";
import { EntityComponent } from "./component.js";
import * as I from "../inspect.js";
import * as PP from "../pprint.js";
import * as MC from "@minecraft/server";

export class EntityRideable extends EntityComponent<MC.EntityRideableComponent> implements I.HasCustomInspection {
    public static readonly typeId = "minecraft:rideable";

    public get controllingSeat(): number {
        return this.raw.controllingSeat;
    }

    public get crouchingSkipInteract(): boolean {
        return this.raw.crouchingSkipInteract;
    }

    public get familyTypes(): IterableIterator<string> {
        return fromIterable(this.raw.getFamilyTypes());
    }

    public get interactText(): string {
        return this.raw.interactText;
    }

    public get pullInEntities(): boolean {
        return this.raw.pullInEntities;
    }

    public get riderCanInteract(): boolean {
        return this.raw.riderCanInteract;
    }

    public get riders(): IterableIterator<Entity> {
        return map(this.raw.getRiders(), raw => {
            return new Entity(raw);
        });
    }

    public get seatCount(): number {
        return this.raw.seatCount;
    }

    public get seats(): IterableIterator<Seat> {
        return map(this.raw.getSeats(), raw => {
            return new Seat(raw);
        });
    }

    public addRider(rider: Entity): boolean {
        return this.raw.addRider(rider.raw);
    }

    public ejectRider(rider: Entity): void {
        return this.raw.ejectRider(rider.raw);
    }

    public ejectRiders(): void {
        return this.raw.ejectRiders();
    }

    /// @internal
    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                                   stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc,
                                   opts: Required<I.InspectOptions>): PP.Doc {
        const obj: any = {
            controllingSeat: this.controllingSeat,
        };
        if (this.crouchingSkipInteract)
            obj.crouchingSkipInteract = true;
        if (this.interactText !== "")
            obj.interactText = this.interactText;
        if (this.pullInEntities)
            obj.pullInEntities = true;
        if (this.riderCanInteract)
            obj.riderCanInteract = true;

        // Displaying the entire Entity for each rider would be too
        // verbose. Do it when showHidden is enabled, otherwise only show
        // their entity IDs.
        if (this.raw.getRiders().length > 0) {
            if (opts.showHidden)
                obj.riders = Array.from(this.riders);
            else
                obj.riders = Array.from(this.riders).map(rider => rider.id);
        }

        if (this.raw.getSeats().length > 0)
            obj.seats = Array.from(this.seats);

        return PP.spaceCat(
            stylise(PP.text("EntityRideable"), I.TokenType.Class),
            inspect(obj));
    }
}

class Seat extends Wrapper<MC.Seat> implements I.HasCustomInspection {
    public get lockRiderRotation(): number {
        return this.raw.lockRiderRotation;
    }

    public get maxRiderCount(): number {
        return this.raw.maxRiderCount;
    }

    public get minRiderCount(): number {
        return this.raw.minRiderCount;
    }

    public get position(): Location {
        return new Location(this.raw.position);
    }

    /// @internal
    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                                   stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc,
                                   _opts: Required<I.InspectOptions>): PP.Doc {
        const obj: any = {
            lockRiderRotation: this.lockRiderRotation,
            maxRiderCount:     this.maxRiderCount,
            minRiderCount:     this.minRiderCount,
            position:          this.position,
        };
        return PP.spaceCat(
            stylise(PP.text("Seat"), I.TokenType.Class),
            inspect(obj));
    }
}
