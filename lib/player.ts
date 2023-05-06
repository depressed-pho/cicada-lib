import { Entity } from "./entity.js";
import { EntityInventory } from "./entity/inventory.js";
import { PlayerConsole } from "./player/console.js";
import { MessageType } from "@protobuf-ts/runtime";
import { RawMessage } from "@minecraft/server";
import { IPreferencesContainer } from "./preferences.js";
import * as Prefs from "./preferences.js";
import * as MC from "@minecraft/server";

export { ScreenDisplay, PlayerLeaveEvent } from "@minecraft/server";

export class Player extends Entity implements IPreferencesContainer {
    /** Package private: user code should not use this. */
    public constructor(rawPlayer: MC.Player) {
        super(rawPlayer);
    }

    // NOTE: We cannot simply override "get raw()" due to
    // https://github.com/microsoft/TypeScript/issues/41347
    public get rawPlayer(): MC.Player {
        return super.raw as MC.Player;
    }

    public get name(): string {
        return this.rawPlayer.name;
    }

    public get inventory(): EntityInventory {
        return new EntityInventory(
            this.rawPlayer.getComponent("minecraft:inventory") as MC.EntityInventoryComponent);
    }

    public get onScreenDisplay(): MC.ScreenDisplay {
        return this.rawPlayer.onScreenDisplay;
    }

    /** A Console API that sends messages to the chat screen of this
     * player. The message will also be sent to the content log. This is
     * mainly for error reporting and debugging. Use {@link sendMessage}
     * for regular messages. */
    public get console(): Console {
        return new PlayerConsole(this);
    }

    /** Obtain the per-player preferences object for this player. */
    public getPreferences<T extends object>(ty: MessageType<T>): T {
        return Prefs.decodeOrCreate(
            ty,
            this.getDynamicProperty(
                Prefs.dynamicPropertyId("player"),
                "string?"));
    }

    /** Update the per-player preferences object for this player. */
    public setPreferences<T extends object>(ty: MessageType<T>, prefs: T): void {
        this.setDynamicProperty(
            Prefs.dynamicPropertyId("player"),
            Prefs.encode(ty, prefs));
    }

    public sendMessage(msg: (RawMessage|string)[]|RawMessage|string): void {
        this.rawPlayer.sendMessage(msg);
    }
}

export interface PlayerSpawnEvent {
    readonly initialSpawn: boolean;
    readonly player: Player;
}
