import { type Player } from "../player.js";
import { Wrapper } from "../wrapper.js";
import * as I from "../inspect.js";
import * as PP from "../pprint.js";
import * as MC from "@minecraft/server";

export class ItemCooldown extends Wrapper<MC.ItemCooldownComponent> implements I.HasCustomInspection {
    public get category(): string {
        return this.raw.cooldownCategory;
    }

    public get ticks(): number {
        return this.raw.cooldownTicks;
    }

    public start(player: Player): void {
        this.raw.startCooldown(player.rawPlayer);
    }

    /// @internal
    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                                   stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc): PP.Doc {
        const obj: any = {
            category: this.category,
            ticks: this.ticks,
        };
        return PP.spaceCat(
            stylise(PP.text("ItemCooldown"), I.TokenType.Class),
            inspect(obj));
    }
}
