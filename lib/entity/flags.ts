import { EntityComponent } from "./component.js";
import * as I from "../inspect.js";
import * as PP from "../pprint.js";
import * as MC from "@minecraft/server";

// Base class for empty entity components that serve as flags.
export class EntityFlag<T extends MC.EntityComponent> extends EntityComponent<T> implements I.HasCustomInspection {
    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                                   stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc,
                                   _opts: Required<I.InspectOptions>): PP.Doc {
        return PP.spaceCat(
            stylise(PP.text(this.constructor.name), I.TokenType.Class),
            inspect({}));
    }
}

export class EntityCanClimb extends EntityFlag<MC.EntityCanClimbComponent> {
    public static readonly typeId = "minecraft:can_climb";
}

export class EntityIsHiddenWhenInvisible extends EntityFlag<MC.EntityIsHiddenWhenInvisibleComponent> {
    public static readonly typeId = "minecraft:is_hidden_when_invisible";
}
