import { Container } from "../container.js";
import * as I from "../inspect.js";
import * as PP from "../pprint.js";
import * as MC from "@minecraft/server";

export class EntityInventory extends Container implements I.HasCustomInspection {
    readonly #rawInv: MC.EntityInventoryComponent;

    public static readonly typeId = "minecraft:inventory";

    /// @internal
    public constructor(rawInv: MC.EntityInventoryComponent) {
        if (rawInv.container)
            super(rawInv.container);
        else
            throw new Error(`This entity does not have a valid container`);

        this.#rawInv = rawInv;
    }

    public get typeId(): string {
        return this.#rawInv.typeId;
    }

    public get isValid(): boolean {
        return this.#rawInv.isValid();
    }

    public get additionalSlotsPerStrength(): number {
        return this.#rawInv.additionalSlotsPerStrength;
    }

    public get canBeSiphonedFrom(): boolean {
        return this.#rawInv.canBeSiphonedFrom;
    }

    public get containerType(): string {
        return this.#rawInv.containerType;
    }

    public get "private"(): boolean {
        return this.#rawInv.private;
    }

    public get restrictToOwner(): boolean {
        return this.#rawInv.restrictToOwner;
    }

    /// @internal
    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                                   stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc): PP.Doc {
        const obj: any = {
            containerType: this.containerType,
        };

        // Now we want to display "this" as Container instead of
        // EntityInventory, so that inspecting obj.container will invoke
        // super[I.customInspectSymbol]. This is super hacky but I can't
        // think of any better ways.
        // @ts-ignore: TypeScript doesn't like super[key].
        const getSuperProp = (key: PropertyKey) => super[key];
        obj.container = new Proxy(this, {
            "get"(self: EntityInventory, key: PropertyKey): any {
                const prop = getSuperProp(key);
                if (typeof prop === "function")
                    return prop.bind(self);
                else
                    return prop;
            }
        });

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
