import { Entity } from "./entity.js";
import { EntityInventory } from "./entity/inventory.js";
import { PlayerConsole } from "./player/console.js";
import { MessageType } from "@protobuf-ts/runtime";
import { RawMessage } from "@minecraft/server";
import { IPreferencesContainer } from "./preferences.js";
import { GameMode } from "@minecraft/server";
import * as Prefs from "./preferences.js";
import * as MC from "@minecraft/server";

export { GameMode };
export { ScreenDisplay, PlayerLeaveAfterEvent } from "@minecraft/server";

export interface IPlayerSession {
    /** Called when the player is about to leave. This function will be
     * called in read-only mode.
     */
    destroy(): void;
}

export class Player extends Entity implements IPreferencesContainer {
    /** Package private: user code should not use this. */
    public constructor(rawPlayer: MC.Player) {
        super(rawPlayer);
    }

    /** Package private: user code should not use this. */
    public get rawPlayer(): MC.Player {
        // NOTE: We cannot simply override "get raw()", possibly due to
        // https://github.com/microsoft/TypeScript/issues/41347
        return super.raw as MC.Player;
    }

    public get gameMode(): GameMode {
        // It is surprising that this is the only way to obtain the
        // per-player game mode. Hope the future API will allow us to do it
        // efficiently.
        if (this.matches({gameMode: GameMode.adventure})) return GameMode.adventure;
        if (this.matches({gameMode: GameMode.creative })) return GameMode.creative;
        if (this.matches({gameMode: GameMode.spectator})) return GameMode.spectator;
        if (this.matches({gameMode: GameMode.survival })) return GameMode.survival;
        throw new Error(`Cannot detect the game mode for player ${this.name}`);
    }

    public get inventory(): EntityInventory {
        return new EntityInventory(
            this.rawPlayer.getComponent("minecraft:inventory") as MC.EntityInventoryComponent);
    }

    public get name(): string {
        return this.rawPlayer.name;
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

    /** Obtain a player session object. To use this method, you first need
     * to register your session class using {@link
     * World.prototype.usePlayerSessions}.
     */
    public getSession<T extends IPlayerSession>(): T {
        return SessionManager.get(this.id) as T;
    }

    public sendMessage(msg: (RawMessage|string)[]|RawMessage|string): void {
        this.rawPlayer.sendMessage(msg);
    }
}

/** Package private: user code should not use this. */
export class SessionManager {
    static readonly #sessions: Map<string, IPlayerSession> = new Map(); // playerId => IPlayerSession
    static #ctor?: new (player: Player) => IPlayerSession;

    public static set "class"(ctor: new (player: Player) => IPlayerSession) {
        if (this.#ctor)
            throw new Error("A session class cannot be changed once it's set");
        else
            this.#ctor = ctor;
    }

    public static create(player: Player): IPlayerSession {
        if (!this.#ctor)
            throw new Error("No session classes have been set");

        if (this.#sessions.has(player.id))
            throw new Error(`Duplicate session for player ${player.id} (${player.name})`);

        const session = new (this.#ctor)(player);
        this.#sessions.set(player.id, session);
        return session;
    }

    public static destroy(playerId: string) {
        const session = this.#sessions.get(playerId);
        if (session) {
            this.#sessions.delete(playerId);
            session.destroy();
        }
        else {
            throw new Error(`Session not found for player ${playerId}`);
        }
    }

    public static "get"(playerId: string): IPlayerSession {
        const session = this.#sessions.get(playerId);
        if (session) {
            return session;
        }
        else {
            if (this.#ctor)
                throw new Error(`Session not found for player ${playerId}`);
            else
                throw new Error("The session manager hasn't been configured");
        }
    }
}

export interface PlayerLeaveBeforeEvent {
    readonly player: Player;
}

export interface PlayerSpawnAfterEvent {
    readonly initialSpawn: boolean;
    readonly player: Player;
}
