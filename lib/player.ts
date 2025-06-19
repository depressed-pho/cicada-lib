import { Dimension } from "./dimension.js";
import { Entity } from "./entity.js";
import { EntityHealth, EntityLavaMovement, EntityMovement, EntityUnderwaterMovement } from "./entity/attributes.js";
import { EntityBreathable } from "./entity/breathable.js";
import { EntityEquipment } from "./entity/equipment.js";
import { EntityInventory } from "./entity/inventory.js";
import { EntityRideable } from "./entity/rideable.js";
import { map } from "./iterable.js";
import { Location } from "./location.js";
import { PlayerConsole } from "./player/console.js";
import { Wrapper } from "./wrapper.js";
import { MessageType } from "@protobuf-ts/runtime";
import { RawMessage } from "@minecraft/server";
import { IPreferencesContainer } from "./preferences.js";
import { GameMode, PlayerPermissionLevel, PlayerSoundOptions } from "@minecraft/server";
import * as Prefs from "./preferences.js";
import * as I from "./inspect.js";
import * as PP from "./pprint.js";
import * as MC from "@minecraft/server";

export { GameMode, PlayerPermissionLevel, PlayerSoundOptions };
export { ScreenDisplay, PlayerLeaveAfterEvent } from "@minecraft/server";

export interface DimensionLocation {
    dimension: Dimension,
    location:  Location,
}

export interface IPlayerSession {
    /** Called when the player is about to leave. This function will be
     * called in read-only mode.
     */
    destroy(): void;
}

export class Player extends Entity implements IPreferencesContainer, I.HasCustomInspection {
    #session?: any;

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

    /** A Console API that sends messages to the chat screen of this
     * player. The message will also be sent to the content log. This is
     * mainly for error reporting and debugging. Use {@link sendMessage}
     * for regular messages. */
    public get console(): Console {
        return new PlayerConsole(this);
    }

    public get gameMode(): GameMode {
        return this.rawPlayer.getGameMode();
    }

    public get isEmoting(): boolean {
        return this.rawPlayer.isEmoting;
    }

    public get isFlying(): boolean {
        return this.rawPlayer.isFlying;
    }

    public get isGliding(): boolean {
        return this.rawPlayer.isGliding;
    }

    public get isJumping(): boolean {
        return this.rawPlayer.isJumping;
    }

    public get permissionLevel(): PlayerPermissionLevel {
        // Why do we not redefine the enum with strings? Because numeric
        // values make sense if they were to be compared by their order.
        return this.rawPlayer.playerPermissionLevel;
    }

    public get level(): number {
        return this.rawPlayer.level;
    }

    public get name(): string {
        return this.rawPlayer.name;
    }

    public get onScreenDisplay(): MC.ScreenDisplay {
        return this.rawPlayer.onScreenDisplay;
    }

    public get selectedSlotIndex(): number {
        return this.rawPlayer.selectedSlotIndex;
    }
    public set selectedSlotIndex(slot: number) {
        this.rawPlayer.selectedSlotIndex = slot;
    }

    public get spawnPoint(): DimensionLocation|undefined {
        const raw = this.rawPlayer.getSpawnPoint();
        if (raw)
            return {
                dimension: new Dimension(raw.dimension),
                location:  new Location(raw.x, raw.y, raw.z),
            };
        else
            return undefined;
    }
    public set spawnPoint(dl: DimensionLocation|undefined) {
        if (dl)
            this.rawPlayer.setSpawnPoint({
                dimension: dl.dimension.raw,
                x:         dl.location.x,
                y:         dl.location.y,
                z:         dl.location.z,
            });
        else
            this.rawPlayer.setSpawnPoint();
    }

    public get totalXp(): number {
        return this.rawPlayer.getTotalXp();
    }

    public get totalXpNeededForNextLevel(): number {
        return this.rawPlayer.totalXpNeededForNextLevel;
    }

    public get xpEarnedAtCurrentLevel(): number {
        return this.rawPlayer.xpEarnedAtCurrentLevel;
    }

    /** Add/remove experience to/from the player and return their current
     * experience. The amount can be negative.
     */
    public addExperience(amount: number): number {
        return this.rawPlayer.addExperience(amount);
    }

    /** Add/remove level to/from the player and return their current
     * level. The amount can be negative.
     */
    public addLevels(amount: number): number {
        return this.rawPlayer.addLevels(amount);
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
        if (this.#session === undefined)
            this.#session = SessionManager.get(this.id);

        return this.#session as T;
    }

    public playSound(soundId: string, soundOptions?: PlayerSoundOptions): void {
        this.rawPlayer.playSound(soundId, soundOptions);
    }

    public resetLevel(): void {
        this.rawPlayer.resetLevel();
    }

    public sendMessage(msg: (RawMessage|string)[]|RawMessage|string): void {
        this.rawPlayer.sendMessage(msg);
    }

    // --------- Components ---------

    // These components should always exist.
    public override get breathable(): EntityBreathable {
        return super.breathable!;
    }

    public override get equipment(): EntityEquipment {
        return super.equipment!;
    }

    public override get health(): EntityHealth {
        return super.health!;
    }

    public override get inventory(): EntityInventory {
        return super.inventory!;
    }

    public override get lavaMovement(): EntityLavaMovement {
        return super.lavaMovement!;
    }

    public override get movement(): EntityMovement {
        return super.movement!;
    }

    public override get rideable(): EntityRideable {
        return super.rideable!;
    }

    public override get underwaterMovement(): EntityUnderwaterMovement {
        return super.underwaterMovement!;
    }

    /// @internal
    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                                  stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc): PP.Doc {
        const obj: any = {
            name:         this.name,
            dimension:    this.dimension,
            location:     this.location,
            experience: {
                level:                     this.level,
                totalXp:                   this.totalXp,
                totalXpNeededForNextLevel: this.totalXpNeededForNextLevel,
                xpEarnedAtCurrentLevel:    this.xpEarnedAtCurrentLevel,
            },
            selectedSlotIndex: this.selectedSlotIndex,
            gameMode: (() => {
                switch (this.gameMode) {
                    case GameMode.Adventure: return "adventure";
                    case GameMode.Creative:  return "creative";
                    case GameMode.Spectator: return "spectator";
                    case GameMode.Survival:  return "survival";
                    default:
                        return `unknown (${this.gameMode})`;
                }
            })(),
            permissionLevel: (() => {
                switch (this.permissionLevel) {
                    case PlayerPermissionLevel.Visitor:  return "visitor";
                    case PlayerPermissionLevel.Member:   return "member";
                    case PlayerPermissionLevel.Operator: return "operator";
                    case PlayerPermissionLevel.Custom:   return "custom";
                    default:
                        return `unknown (${this.permissionLevel})`;
                }
            })()
        };
        if (this.isSneaking)
            obj.isSneaking = true;
        if (this.isEmoting)
            obj.isEmoting = true;
        if (this.isFlying)
            obj.isFlying = true;
        if (this.isGliding)
            obj.isGliding = true;
        if (this.isJumping)
            obj.isJumping = true;
        if (this.spawnPoint)
            obj.spawnPoint = this.spawnPoint;
        if (this.tags.size > 0)
            obj.tags = this.tags;

        // These are flags but are in fact components.
        if (this.canClimb)
            obj.canClimb = true;
        if (this.isHiddenWhenInvisible)
            obj.isHiddenWhenInvisible = true;

        const comps = new Set<any>([
            this.breathable,
            this.health,
            this.inventory,
            this.lavaMovement,
            this.movement,
            this.rideable,
            this.underwaterMovement,
        ]);
        try {
            if (this.equipment.size > 0)
                comps.add(this.equipment);
        }
        catch (e) {
            if (I.looksLikeReadonlyError(e))
                // EntityEquippableComponent.prototype.getEquipment() isn't
                // callable in read-only mode.
                comps.add(this.equipment);
            else
                throw e;
        }
        for (const comp of this.raw.getComponents()) {
            switch (comp.typeId) {
                case EntityBreathable.typeId:
                case "minecraft:can_climb":
                case EntityHealth.typeId:
                case EntityEquipment.typeId:
                case EntityInventory.typeId:
                case "minecraft:is_hidden_when_invisible":
                case EntityLavaMovement.typeId:
                case EntityMovement.typeId:
                case EntityRideable.typeId:
                case EntityUnderwaterMovement.typeId:
                    // These are already inspected in our own way.
                    break;
                default:
                    comps.add(comp);
            }
        }
        if (comps.size > 0)
            obj.components = comps;

        return PP.spaceCat(
            stylise(PP.text("Player"), I.TokenType.Class),
            inspect(obj));
    }
}

/// @internal
export class SessionManager {
    static readonly #sessions: Map<string, IPlayerSession> = new Map(); // playerId => IPlayerSession
    static #ctor?: new (player: Player) => IPlayerSession;

    public static get "class"(): (new (player: Player) => IPlayerSession) | undefined {
        return this.#ctor;
    }

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

export class ChatSendBeforeEvent extends Wrapper<MC.ChatSendBeforeEvent> {
    public cancel() {
        this.raw.cancel = true;
    }

    public get message(): string {
        return this.raw.message;
    }

    public get sender(): Player {
        return new Player(this.raw.sender);
    }

    public get targets(): IterableIterator<Player>|undefined {
        if (this.raw.targets)
            return map(this.raw.targets, raw => new Player(raw));
        else
            return undefined;
    }
}

export interface PlayerLeaveBeforeEvent {
    readonly player: Player;
}

export interface PlayerSpawnAfterEvent {
    readonly initialSpawn: boolean;
    readonly player: Player;
}
