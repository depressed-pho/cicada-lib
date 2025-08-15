import { ItemBag } from "../item/bag.js";
import { ItemStack } from "../item/stack.js";
import { map } from "../iterable.js";
//import { LootTableManager } from "../loot-table.js";
import { Wrapper } from "../wrapper.js";
import * as I from "../inspect.js";
import * as PP from "../pprint.js";
import * as MC from "@minecraft/server";

export class EntityType extends Wrapper<MC.EntityType> implements I.HasCustomInspection {
    /** Obtain all available entity types registered within the world. */
    public static getAll(): IterableIterator<EntityType> {
        return map(MC.EntityTypes.getAll(), raw => {
            return new EntityType(raw);
        });
    }

    /// @internal
    public constructor(rawEntityType: MC.EntityType);

    /** Construct an entity type. */
    public constructor(typeId: string);

    public constructor(arg0: MC.EntityType|string) {
        if (arg0 instanceof MC.EntityType) {
            super(arg0);
        }
        else {
            const rawET = MC.EntityTypes.get/*<string>*/(arg0);
            if (rawET)
                super(rawET);
            else
                throw new Error(`No such entity ID exists: ${arg0}`);
        }
    }

    public get id(): string {
        return this.raw.id;
    }

    /** Generate loot from the default instantiation of this entity type as
     * if it had been killed.
     *
     * @param tool
     * Optional. The tool to use in the looting operation.
     *
     * @returns
     * A bag of items dropped from the loot drop event. Can be empty if no
     * loot dropped.
     */
    public generateLoot(_tool?: ItemStack): ItemBag {
        //return LootTableManager.instance.generateLoot(this, tool)!;
        throw new Error("FIXME: LootTableManager is currently unavailable in the stable API");
    }

    /// @internal
    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                                  stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc): PP.Doc {
        const obj: any = {
            id: this.id
        };
        return PP.spaceCat(
            stylise(PP.text("BlockType"), I.TokenType.Class),
            inspect(obj));
    }
}
