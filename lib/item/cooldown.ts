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

    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc): PP.Doc {
        const obj: any = {
            category: this.category,
            ticks: this.ticks,
        };
        Object.defineProperty(obj, Symbol.toStringTag, {value: "ItemCooldown"});
        return inspect(obj);
    }
}
