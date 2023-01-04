import { Entity } from "./entity.js";
import { EntityInventory } from "./entity/inventory.js";
import { MessageType } from "@protobuf-ts/runtime";
import * as Preferences from "./preferences.js";
import * as MC from "@minecraft/server";

export { ScreenDisplay, PlayerLeaveEvent } from "@minecraft/server";

const DYNPROP_PREFERENCES = "cicada-lib:player-preferences";

export class Player extends Entity {
    readonly #player: MC.Player;

    /** The constructor is public only because of a language
     * limitation. User code must never call it directly. */
    public constructor(rawPlayer: MC.Player) {
        super(rawPlayer);
        this.#player = rawPlayer;
    }

    /** Package private: user code should not use this. */
    public get raw(): MC.Player {
        return this.#player;
    }

    public get isSneaking(): boolean {
        return this.#player.isSneaking;
    }

    public get name(): string {
        return this.#player.name;
    }

    public get inventory(): EntityInventory {
        return new EntityInventory(
            this.#player.getComponent("minecraft:inventory") as MC.EntityInventoryComponent);
    }

    public get onScreenDisplay(): MC.ScreenDisplay {
        return this.#player.onScreenDisplay;
    }

    /** Obtain the per-player preferences object for this player. */
    public getPreferences<T extends object>(ty: MessageType<T>): T {
        return Preferences.decodeOrCreate(
            ty,
            this.getDynamicProperty(DYNPROP_PREFERENCES, "string?"));
    }

    /** Update the per-player preferences object for this player. */
    public setPreferences<T extends object>(ty: MessageType<T>, prefs: T): void {
        this.setDynamicProperty(DYNPROP_PREFERENCES, Preferences.encode(ty, prefs));
    }
}

export interface PlayerSpawnEvent {
    readonly initialSpawn: boolean;
    readonly player: Player;
}

/* Unholy side effect... */
MC.world.events.worldInitialize.subscribe(ev => {
    const props = new MC.DynamicPropertiesDefinition();
    props.defineString(DYNPROP_PREFERENCES, 950); // Undocumented maximum at 1000
    ev.propertyRegistry.registerEntityTypeDynamicProperties(props, MC.MinecraftEntityTypes.player);
    // Seriously, only a thousand characters? We will probably have to
    // split our data in several properties then...
});
