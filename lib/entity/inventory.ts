import { Container } from "../container.js";
import * as MC from "@minecraft/server";

export class EntityInventory extends Container {
    // @ts-ignore: #inventory isn't used yet.
    readonly #inventory: MC.EntityInventoryComponent;

    /** The constructor is public only because of a language
     * limitation. User code must never call it directly. */
    public constructor(rawInventory: MC.EntityInventoryComponent) {
        if (rawInventory.container)
            super(rawInventory.container);
        else
            throw new Error(`This entity does not have a valid container`);

        this.#inventory = rawInventory;
    }
}
