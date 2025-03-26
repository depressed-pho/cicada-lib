import { Container } from "../container.js";
import * as I from "../inspect.js";
import * as PP from "../pprint.js";
import * as MC from "@minecraft/server";

export class EntityInventory extends Container implements I.HasCustomInspection {
    readonly #raw: MC.EntityInventoryComponent;

    public static readonly typeId = "minecraft:inventory";

    /// @internal
    public constructor(raw: MC.EntityInventoryComponent) {
        if (raw.container)
            super(raw.container);
        else
            throw new Error(`This entity does not have a valid container`);

        this.#raw = raw;
    }

    public get typeId(): string {
        return this.#raw.typeId;
    }

    public get isValid(): boolean {
        return this.#raw.isValid;
    }

    public get additionalSlotsPerStrength(): number {
        return this.#raw.additionalSlotsPerStrength;
    }

    public get canBeSiphonedFrom(): boolean {
        return this.#raw.canBeSiphonedFrom;
    }

    public get containerType(): string {
        return this.#raw.containerType;
    }

    public get "private"(): boolean {
        return this.#raw.private;
    }

    public get restrictToOwner(): boolean {
        return this.#raw.restrictToOwner;
    }

    /// @internal
    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                                   stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc): PP.Doc {
        const obj: any = {
            containerType: this.containerType,
            container: new Container(this.#raw.container!),
        };
        if (this.additionalSlotsPerStrength > 0)
            obj.additionalSlotsPerStrength = this.additionalSlotsPerStrength;
        if (this.canBeSiphonedFrom)
            obj.canBeSiphonedFrom = true;
        if (this.private)
            obj.private = true;
        if (this.restrictToOwner)
            obj.restrictToOwner = true;
        return PP.spaceCat(
            stylise(PP.text("EntityInventory"), I.TokenType.Class),
            inspect(obj));
    }
}
