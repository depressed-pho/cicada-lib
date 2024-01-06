import { map } from "../iterable.js";
import { Wrapper } from "../wrapper.js";
import * as MC from "@minecraft/server";

export class ItemType extends Wrapper<MC.ItemType> {
    /** Package private */
    public constructor(rawItemType: MC.ItemType);

    /** Construct an item type. */
    public constructor(itemId: string);

    public constructor(arg0: MC.ItemType|string) {
        if (arg0 instanceof MC.ItemType) {
            super(arg0);
        }
        else {
            const rawIt = MC.ItemTypes.get(arg0);
            if (rawIt)
                super(rawIt);
            else
                throw new Error(`No such item ID exists: ${arg0}`);
        }
    }

    public get id(): string {
        return this.raw.id;
    }

    /** Obtain all available item types registered within the world. */
    public static getAll(): IterableIterator<ItemType> {
        return map(MC.ItemTypes.getAll(), raw => {
            return new ItemType(raw);
        });
    }
}
