import { CommandRegistry, CommandTokenisationError, CommandParsingError,
         prettyPrintCommandLine, tokeniseCommandLine } from "./command/legacy.js";
import { Dimension } from "./dimension.js";
import { WorldAfterEvents, WorldBeforeEvents } from "./world/events.js";
import { map } from "./iterable.js";
import { IPlayerSession, Player, PlayerSpawnAfterEvent, SessionManager } from "./player.js";
import { HasDynamicProperties } from "./dynamic-props.js";
import { Wrapper } from "./wrapper.js";
import { MessageType } from "@protobuf-ts/runtime";
import { IPreferencesContainer } from "./preferences.js";
import * as PP from "./pprint.js";
import * as Prefs from "./preferences.js";
import * as MC from "@minecraft/server";

export { EntityQueryOptions } from "@minecraft/server";

export class World extends HasDynamicProperties(Wrapper<MC.World>) implements IPreferencesContainer {
    #isReady: boolean;

    /** World after-event signals */
    public readonly afterEvents: WorldAfterEvents;

    /** World before-event signals */
    public readonly beforeEvents: WorldBeforeEvents;

    /** The constructor is public only because of a language
     * limitation. User code must never call it directly. */
    public constructor(rawWorld: MC.World) {
        super(rawWorld);
        this.#isReady     = false;
        this.afterEvents  = new WorldAfterEvents(this.raw.afterEvents);
        this.beforeEvents = new WorldBeforeEvents(this.raw.beforeEvents);
        this.#glueEvents();

        this.afterEvents.worldLoad.subscribe(() => {
            // Listen to chatSend before events if there is at least one
            // legacy custom command registered (via @command).
            if (!CommandRegistry.empty)
                this.#listenToLegacyCustomCommands();
        });
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
    }

    #glueEvents(): void {
        this.raw.afterEvents.playerSpawn.subscribe(rawEv => {
            if (!this.#isReady) {
                /* The game starts ticking the world even before it's fully
                 * loaded. Players can even join it (and possibly leave it)
                 * before it's ready. This is strange and is very
                 * inconvenient but is apparently an intended
                 * behaviour. Now that a player spawned in the world, we're
                 * sure the world has been loaded.
                 *
                 * But in singleplayer this event can still be trigerred
                 * way before the game starts rendering the world as of
                 * v1.21.60, and we haven't found a way to detect the real
                 * readiness. F*ck you Mojang, why do you keep simple
                 * things this hard.
                 */
                this.#isReady = true;
                this.afterEvents.ready.signal({});
            }

            const ev: PlayerSpawnAfterEvent = {
                initialSpawn: rawEv.initialSpawn,
                player:       new Player(rawEv.player)
            };

            if (ev.initialSpawn && SessionManager.class)
                SessionManager.create(ev.player);

            this.afterEvents.playerSpawn.signal(ev);
        });

        this.raw.afterEvents.playerLeave.subscribe(ev => {
            this.afterEvents.playerLeave.signal(ev);

            if (SessionManager.class)
                SessionManager.destroy(ev.playerId);
        });
    }

    #listenToLegacyCustomCommands() {
        const prefix = ";";

        function render(doc: PP.Doc): string {
            return PP.displayS(PP.renderPretty(1.0, Infinity, doc));
        }

        // Text that players type won't be echoed back to their chat screen
        // when the chatSend event is canceled. So we pretty-print their
        // commands and send them back.
        function echo(tokens: string[]): string {
            return render(
                PP.beside(
                    PP.darkPurple(PP.text(prefix)),
                    PP.align(
                        prettyPrintCommandLine(tokens))));
        }

        this.beforeEvents.chatSend.subscribe(ev => {
            // NOTE: Maybe the prefix should be customisable but Bedrock
            // should really support custom commands natively in the first
            // place.
            if (ev.message.startsWith(prefix)) {
                let tokens: string[]; // TypeScript cannot infer the type of this. LOL.
                try {
                    tokens = tokeniseCommandLine(ev.message, 1);
                }
                catch (e) {
                    if (e instanceof CommandTokenisationError) {
                        // Tokenisation errors should be ignored because it
                        // might be for a different addon.
                        return;
                    }
                    else {
                        // What's this. Is it an internal error?
                        throw e;
                    }
                }

                try {
                    if (tokens.length >= 1) {
                        CommandRegistry.get(
                            ev.sender, tokens[0]!, tokens.slice(1),
                            cmd => {
                                ev.cancel();
                                ev.sender.sendMessage(echo(tokens));
                                cmd.run(ev.sender);
                            },
                            // Don't cancel the event when there is no such
                            // command. It might be for a different addon.
                            () => void 0);
                    }
                }
                catch (e) {
                    if (e instanceof CommandParsingError) {
                        // We know the user attempted to run one of our
                        // commands but it was malformed.
                        ev.cancel();
                        ev.sender.sendMessage(echo(tokens));
                        // NOTE: Ideally this should be localized but how?
                        // We must somehow merge lang files, but cicada-lib
                        // should NOT rely on cicada-build.
                        ev.sender.sendMessage(render(PP.hcat([
                            PP.red(PP.text("Command error:")),
                            PP.space,
                            PP.string(e.message)
                        ])));
                        // FIXME: Show usage
                    }
                    else {
                        // We know the user attempted to run one of our
                        // commands but it somehow failed.
                        ev.cancel();
                        ev.sender.sendMessage(echo(tokens));
                        ev.sender.console.error(e);
                    }
                }
            }
        });
    }
}

export const world = new World(MC.world);
