import { IEventSignal, CustomEventSignal, GluedEventSignalWithoutOptions,
         GluedEventSignalWithOptions } from "../event.js";
import { Block, BlockPermutation, BlockBreakAfterEvent, BlockPlaceAfterEvent } from "../block.js";
import { PistonActivateAfterEvent, PistonActivateBeforeEvent } from "../block/minecraft/piston.js";
import { Dimension } from "../dimension.js";
import { Entity, ItemUseAfterEvent, EntityDieAfterEvent, EntityEventOptions,
         entityEventOptionsToRaw } from "../entity.js";
import { ItemStack } from "../item/stack.js";
import { Player, PlayerSpawnAfterEvent } from "../player.js"
import { Wrapper } from "../wrapper.js";
import { PropertyRegistry, WorldInitializeAfterEvent } from "./init.js";
import * as MC from "@minecraft/server";

export class WorldAfterEvents extends Wrapper<MC.WorldAfterEvents> {
    public readonly blockBreak:      IEventSignal<BlockBreakAfterEvent>;
    public readonly blockPlace:      IEventSignal<BlockPlaceAfterEvent>;
    public readonly entityDie:       IEventSignal<EntityDieAfterEvent, EntityEventOptions>;
    public readonly itemUse:         IEventSignal<ItemUseAfterEvent>;
    public readonly pistonActivate:  IEventSignal<PistonActivateAfterEvent>;
    public readonly worldInitialize: IEventSignal<WorldInitializeAfterEvent>;
    /** An event that is fired when the world is fully loaded. */
    public readonly ready:           CustomEventSignal<ReadyAfterEvent>;
    public readonly playerSpawn:     CustomEventSignal<PlayerSpawnAfterEvent>;
    public readonly playerLeave:     CustomEventSignal<MC.PlayerLeaveAfterEvent>;

    /// Package private
    public constructor(rawEvents: MC.WorldAfterEvents) {
        super(rawEvents);
        this.blockBreak = new GluedEventSignalWithoutOptions(
            this.raw.blockBreak,
            (rawEv: MC.BlockBreakAfterEvent) => {
                return {
                    block:                  new Block(rawEv.block),
                    brokenBlockPermutation: new BlockPermutation(rawEv.brokenBlockPermutation),
                    dimension:              new Dimension(rawEv.dimension),
                    player:                 new Player(rawEv.player)
                };
            });
        this.blockPlace = new GluedEventSignalWithoutOptions(
            this.raw.blockPlace,
            (rawEv: MC.BlockPlaceAfterEvent) => {
                return {
                    block:     new Block(rawEv.block),
                    dimension: new Dimension(rawEv.dimension),
                    player:    new Player(rawEv.player)
                };
            });
        this.entityDie = new GluedEventSignalWithOptions(
            this.raw.entityDie,
            (rawEv: MC.EntityDieAfterEvent) => {
                return {
                    damageCause: rawEv.damageCause,
                    deadEntity:  new Entity(rawEv.deadEntity)
                };
            },
            entityEventOptionsToRaw);
        this.itemUse = new GluedEventSignalWithoutOptions(
            this.raw.itemUse,
            (rawEv: MC.ItemUseAfterEvent) => {
                return {
                    itemStack: new ItemStack(rawEv.itemStack),
                    source:    rawEv.source.typeId === "minecraft:player"
                        ? new Player(rawEv.source as MC.Player)
                        : new Entity(rawEv.source)
                };
            });
        this.pistonActivate = new GluedEventSignalWithoutOptions(
            this.raw.pistonActivate,
            (rawEv: MC.PistonActivateAfterEvent) => new PistonActivateAfterEvent(rawEv));
        this.worldInitialize = new GluedEventSignalWithoutOptions(
            this.raw.worldInitialize,
            (rawEv: MC.WorldInitializeAfterEvent) => {
                return {
                    propertyRegistry: new PropertyRegistry(rawEv.propertyRegistry)
                };
            });
        this.ready       = new CustomEventSignal();
        this.playerSpawn = new CustomEventSignal();
        this.playerLeave = new CustomEventSignal();
    }
}

export class WorldBeforeEvents extends Wrapper<MC.WorldBeforeEvents> {
    public readonly pistonActivate: IEventSignal<PistonActivateBeforeEvent>;

    /// Package private
    public constructor(rawEvents: MC.WorldBeforeEvents) {
        super(rawEvents);
        this.pistonActivate = new GluedEventSignalWithoutOptions(
            this.raw.pistonActivate,
            (rawEv: MC.PistonActivateBeforeEvent) => new PistonActivateBeforeEvent(rawEv));
    }
}

export interface ReadyAfterEvent {}
