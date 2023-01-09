import { WorldEvents } from "./world/events.js";
import { map } from "./iterable.js";
import { Player, PlayerSpawnEvent } from "./player.js"
import * as MC from "@minecraft/server";

export { EntityQueryOptions } from "@minecraft/server";

export class World {
    readonly #world: MC.World;
    #isReady: boolean;
    #readinessProbe: number|null; // runScheduleId
    #pendingEvents: (() => void)[];

    /** World event signals */
    public readonly events: WorldEvents;

    /** The constructor is public only because of a language
     * limitation. User code must never call it directly. */
    public constructor(rawWorld: MC.World) {
        this.#world          = rawWorld;
        this.#isReady        = false;
        this.#readinessProbe = null;
        this.#pendingEvents  = [];

        this.events          = new WorldEvents(rawWorld);

        this.#glueEvents();
    }

    public getPlayers(opts?: MC.EntityQueryOptions): Iterable<Player> {
        // Create an iterable object that progressively constructs Player.
        return map(this.#world.getPlayers(opts), raw => {
            return new Player(raw);
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
                const it = this.#world.getPlayers();
                // World.prototype.getPlayers returns null when it's not
                // ready yet, which isn't even documented!!
                if (it) {
                    this.#isReady = true;
                    this.events.ready.signal({});

                    for (const ev of this.#pendingEvents) {
                        ev();
                    }
                    this.#pendingEvents = [];

                    MC.system.clearRunSchedule(this.#readinessProbe!);
                    this.#readinessProbe = null;
                }
            }
        };
        this.#readinessProbe = MC.system.runSchedule(onTick, 1);

        // FIXME: Remove this glue code when the game supports PlayerSpawnEvent.
        if (this.#world.events.playerSpawn) {
            this.#world.events.playerSpawn.subscribe(rawEv => {
                const ev: PlayerSpawnEvent = {
                    initialSpawn: rawEv.initialSpawn,
                    player:       new Player(rawEv.player)
                };
                if (this.#isReady) {
                    this.events.playerSpawn.signal(ev);
                }
                else {
                    this.#pendingEvents.push(() => {
                        this.events.playerSpawn.signal(ev);
                    });
                }
            });
        }
        else {
            this.#world.events.playerJoin.subscribe((rawEv: any) => {
                const ev: PlayerSpawnEvent = {
                    initialSpawn: true,
                    player:       new Player(rawEv.player)
                };
                if (this.#isReady) {
                    this.events.playerSpawn.signal(ev);
                }
                else {
                    this.#pendingEvents.push(() => {
                        this.events.playerSpawn.signal(ev);
                    });
                }
            });
        }

        this.#world.events.playerLeave.subscribe(ev => {
            if (this.#isReady) {
                this.events.playerLeave.signal(ev);
            }
            else {
                this.#pendingEvents.push(() => {
                    this.events.playerLeave.signal(ev);
                });
            }
        });
    }
}

export const world = new World(MC.world);
