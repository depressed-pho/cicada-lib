import { EventEmitter, EventName } from "./event-emitter.js"
import { Entity, ItemUseEvent } from "./entity.js";
import { ItemStack } from "./item-stack.js";
import { Player, PlayerSpawnEvent } from "./player.js"
import * as MC from "@minecraft/server";

interface Event {
    name: EventName,
    event: any
}

export class World extends EventEmitter {
    readonly #world: MC.World;
    #isReady: boolean;
    #readinessProbe: number|null; // runScheduleId
    #pendingEvents: Event[];

    /** The constructor is public only because of a language
     * limitation. User code must never call it directly. */
    public constructor(rawWorld: MC.World) {
        super();

        this.#world          = rawWorld;
        this.#isReady        = false;
        this.#readinessProbe = null;
        this.#pendingEvents  = [];

        this.#glueEvents();
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
                    this.emit("ready");

                    for (const ev of this.#pendingEvents) {
                        this.emit(ev.name, ev.event);
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
                    this.emit("playerSpawn", ev);
                }
                else {
                    this.#pendingEvents.push({name: "playerSpawn", event: ev});
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
                    this.emit("playerSpawn", ev);
                }
                else {
                    this.#pendingEvents.push({name: "playerSpawn", event: ev});
                }
            });
        }

        this.#world.events.playerLeave.subscribe(ev => {
            if (this.#isReady) {
                this.emit("playerLeave", ev);
            }
            else {
                this.#pendingEvents.push({name: "playerLeave", event: ev});
            }
        });

        this.#world.events.itemUse.subscribe(rawEv => {
            const ev: ItemUseEvent = {
                item:   new ItemStack(rawEv.item),
                source: rawEv.source instanceof MC.Player
                    ? new Player(rawEv.source)
                    : new Entity(rawEv.source)
            };
            this.emit("itemUse", ev);
        });
    }
}

export const world = new World(MC.world);
