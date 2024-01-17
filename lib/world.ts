import { Dimension } from "./dimension.js";
import { WorldAfterEvents, WorldBeforeEvents } from "./world/events.js";
import { map } from "./iterable.js";
import { IPlayerSession, Player, PlayerSpawnAfterEvent, SessionManager } from "./player.js";
import { HasDynamicProperties } from "./dynamic-props.js";
import { Wrapper } from "./wrapper.js";
import { MessageType } from "@protobuf-ts/runtime";
import { IPreferencesContainer } from "./preferences.js";
import { Vector3, WorldSoundOptions } from "@minecraft/server";
import * as Prefs from "./preferences.js";
import * as MC from "@minecraft/server";

export { EntityQueryOptions, WorldSoundOptions } from "@minecraft/server";

export class World extends HasDynamicProperties(Wrapper<MC.World>) implements IPreferencesContainer {
    #isReady: boolean;
    #readinessProbe: number|null;
    #pendingEvents: (() => void)[];

    /** World after-event signals */
    public readonly afterEvents: WorldAfterEvents;

    /** World before-event signals */
    public readonly beforeEvents: WorldBeforeEvents;

    /** The constructor is public only because of a language
     * limitation. User code must never call it directly. */
    public constructor(rawWorld: MC.World) {
        super(rawWorld);
        this.#isReady        = false;
        this.#readinessProbe = null;
        this.#pendingEvents  = [];
        this.afterEvents     = new WorldAfterEvents(this.raw.afterEvents);
        this.beforeEvents    = new WorldBeforeEvents(this.raw.beforeEvents);
        this.#glueEvents();
    }

    public getDimension(identifier: string): Dimension {
        return new Dimension(this.raw.getDimension(identifier));
    }

    public getPlayers(opts?: MC.EntityQueryOptions): IterableIterator<Player> {
        // Create an iterable object that progressively constructs Player.
        return map(this.raw.getPlayers(opts), raw => {
            return new Player(raw);
        });
    }

    /** Obtain the per-world preferences object. */
    public getPreferences<T extends object>(ty: MessageType<T>): T {
        return Prefs.decodeOrCreate(
            ty,
            this.getDynamicProperty(
                Prefs.dynamicPropertyId("world"),
                "string?"));
    }

    /** Update the per-world preferences object. */
    public setPreferences<T extends object>(ty: MessageType<T>, prefs: T): void {
        this.setDynamicProperty(
            Prefs.dynamicPropertyId("world"),
            Prefs.encode(ty, prefs));
    }

    public playSound(soundId: string, location: Vector3, soundOptions?: WorldSoundOptions): void {
        this.raw.playSound(soundId, location, soundOptions);
    }

    /** Call this if you want to use the player session manager. This has
     * to be called before any player joins. `sessionClass` is your session
     * class which will be constructed whenever a player joins, and will be
     * destroyed when they leave. The class has to have a constructor
     * taking a single argument of type `Player`, and must implement the
     * interface `IPlayerSession`.
     */
    public usePlayerSessions<T extends IPlayerSession>(
        sessionClass: new (player: Player) => T) {

        if (this.#isReady)
            throw new Error(
                "The world is already up and running. It's too late to configure player sessions.");

        SessionManager.class = sessionClass;

        this.afterEvents.playerSpawn.subscribe(ev => {
            if (ev.initialSpawn)
                SessionManager.create(ev.player);
        });
        this.beforeEvents.playerLeave.subscribe(ev => {
            SessionManager.destroy(ev.player.id);
        });
    }

    #glueEvents(): void {
        /* The game starts ticking the world even before it's fully
         * loaded. Players can even join it (and possibly leave it) before
         * it's ready. This is strange and is very inconvenient but is
         * apparently an intended behaviour. THINKME: Maybe the upcoming
         * PlayerSpawnEvent will fire after a full load? Check that.
         */
        const onTick = () => {
            if (!this.#isReady) {
                const it = this.raw.getPlayers();
                // World.prototype.getPlayers returns null when it's not
                // ready yet, which isn't even documented!!
                if (it) {
                    this.#isReady = true;
                    this.afterEvents.ready.signal({});

                    for (const ev of this.#pendingEvents) {
                        ev();
                    }
                    this.#pendingEvents = [];

                    MC.system.clearRun(this.#readinessProbe!);
                    this.#readinessProbe = null;
                }
            }
        };
        this.#readinessProbe = MC.system.runInterval(onTick, 1);

        this.raw.afterEvents.playerSpawn.subscribe(rawEv => {
            const ev: PlayerSpawnAfterEvent = {
                initialSpawn: rawEv.initialSpawn,
                player:       new Player(rawEv.player)
            };
            if (this.#isReady) {
                this.afterEvents.playerSpawn.signal(ev);
            }
            else {
                this.#pendingEvents.push(() => {
                    this.afterEvents.playerSpawn.signal(ev);
                });
            }
        });

        this.raw.afterEvents.playerLeave.subscribe(ev => {
            if (this.#isReady) {
                this.afterEvents.playerLeave.signal(ev);
            }
            else {
                this.#pendingEvents.push(() => {
                    this.afterEvents.playerLeave.signal(ev);
                });
            }
        });
    }
}

export const world = new World(MC.world);
