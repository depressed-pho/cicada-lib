import { Entity } from "./entity.js";
import { EntityInventory } from "./entity/inventory.js";
import { PlayerConsole } from "./player/console.js";
import { MessageType } from "@protobuf-ts/runtime";
import * as Preferences from "./preferences.js";
import * as MC from "@minecraft/server";

export { ScreenDisplay, PlayerLeaveEvent } from "@minecraft/server";

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

    /** A Console API that sends messages to the chat screen of this
     * player. The message will also be sent to the content log. This is
     * mainly for error reporting and debugging. Use {@link sendMessage}
     * for regular messages. */
    public get console(): Console {
        return new PlayerConsole(this.#player);
    }

    /** Obtain the per-player preferences object for this player. */
    public getPreferences<T extends object>(ty: MessageType<T>): T {
        return Preferences.decodeOrCreate(
            ty,
            this.getDynamicProperty(
                Preferences.dynamicPropertyId("player"),
                "string?"));
    }

    /** Update the per-player preferences object for this player. */
    public setPreferences<T extends object>(ty: MessageType<T>, prefs: T): void {
        this.setDynamicProperty(
            Preferences.dynamicPropertyId("player"),
            Preferences.encode(ty, prefs));
    }

    public sendMessage(msg: (MC.RawMessage|string)[]|MC.RawMessage|string): void {
        this.#player.sendMessage(msg);
    }
}

export interface PlayerSpawnEvent {
    readonly initialSpawn: boolean;
    readonly player: Player;
}
