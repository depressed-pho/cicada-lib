import { EntityComponent } from "./component.js";
import * as I from "../inspect.js";
import * as PP from "../pprint.js";
import * as MC from "@minecraft/server";

/// Base class for entity attribute components.
class EntityAttribute<T extends MC.EntityAttributeComponent> extends EntityComponent<T> implements I.HasCustomInspection {
    public get current(): number {
        return this.raw.currentValue;
    }
    public set current(value: number) {
        this.raw.setCurrentValue(value);
    }

    public get default(): number {
        return this.raw.defaultValue;
    }

    public get max(): number {
        return this.raw.effectiveMax;
    }

    public get min(): number {
        return this.raw.effectiveMin;
    }

    /// @internal
    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                                   stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc,
                                   _opts: Required<I.InspectOptions>): PP.Doc {
        return PP.spaceCat(
            stylise(PP.text(this.constructor.name), I.TokenType.Class),
            PP.hsep([
                inspect(this.current),
                stylise(
                    PP.brackets(PP.spaceCat(PP.text("default:"), PP.number(this.default))),
                    I.TokenType.Tag),
                stylise(
                    PP.brackets(PP.spaceCat(PP.text("min:"), PP.number(this.min))),
                    I.TokenType.Tag),
                stylise(
                    PP.brackets(PP.spaceCat(PP.text("max:"), PP.number(this.max))),
                    I.TokenType.Tag)
            ]));
    }
}

export class EntityExhaustion extends EntityAttribute<MC.EntityExhaustionComponent> {
    public static readonly typeId = "minecraft:player.exhaustion";
}

export class EntityHealth extends EntityAttribute<MC.EntityHealthComponent> {
    public static readonly typeId = "minecraft:health";
}

export class EntityHunger extends EntityAttribute<MC.EntityHungerComponent> {
    public static readonly typeId = "minecraft:player.hunger";
}

export class EntityLavaMovement extends EntityAttribute<MC.EntityLavaMovementComponent> {
    public static readonly typeId = "minecraft:lava_movement";
}

export class EntityMovement extends EntityAttribute<MC.EntityMovementComponent> {
    public static readonly typeId = "minecraft:movement";
}

export class EntitySaturation extends EntityAttribute<MC.EntitySaturationComponent> {
    public static readonly typeId = "minecraft:player.saturation";
}

export class EntityUnderwaterMovement extends EntityAttribute<MC.EntityUnderwaterMovementComponent> {
    public static readonly typeId = "minecraft:underwater_movement";
}
