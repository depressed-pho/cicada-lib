import { Container } from "../container.js";
import * as I from "../inspect.js";
import * as PP from "../pprint.js";
import * as MC from "@minecraft/server";

export class BlockInventory extends Container implements I.HasCustomInspection {
    readonly #raw: MC.BlockInventoryComponent;

    public static readonly typeId = "minecraft:inventory";

    /// @internal
    public constructor(raw: MC.BlockInventoryComponent) {
        if (raw.container)
            super(raw.container);
        else
            throw new Error(`This block does not have a valid container`);

        this.#raw = raw;
    }

    /// @internal
    public override [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                                            stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc
                                           ): PP.Doc {
        const obj: any = {
            container: new Container(this.#raw.container!),
        };

        return PP.spaceCat(
            stylise(PP.text("BlockInventory"), I.TokenType.Class),
            inspect(obj));
    }
}
