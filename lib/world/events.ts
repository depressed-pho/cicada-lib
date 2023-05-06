import { IEventSignal, CustomEventSignal, GluedEventSignalWithoutOptions,
         GluedEventSignalWithOptions } from "../event.js";
import { Block, BlockPermutation, BlockBreakEvent, BlockPlaceEvent } from "../block.js";
import { Piston, PistonActivateEvent } from "../block/minecraft/piston.js";
import { Dimension } from "../dimension.js";
import { Entity, ItemUseEvent, EntityDieEvent, EntityEventOptions,
         entityEventOptionsToRaw } from "../entity.js";
import { ItemStack } from "../item/stack.js";
import { Player, PlayerSpawnEvent } from "../player.js"
import { Wrapper } from "../wrapper.js";
import { PropertyRegistry, WorldInitializeEvent } from "./init.js";
import * as MC from "@minecraft/server";

export class WorldEvents extends Wrapper<MC.Events> {
    public readonly blockBreak:      IEventSignal<BlockBreakEvent>;
    public readonly blockPlace:      IEventSignal<BlockPlaceEvent>;
    public readonly entityDie:       IEventSignal<EntityDieEvent, EntityEventOptions>;
    public readonly itemUse:         IEventSignal<ItemUseEvent>;
    public readonly pistonActivate:  IEventSignal<PistonActivateEvent>;
    public readonly worldInitialize: IEventSignal<WorldInitializeEvent>;
    /** An event that is fired when the world is fully loaded. */
    public readonly ready:           CustomEventSignal<ReadyEvent>;
    public readonly playerSpawn:     CustomEventSignal<PlayerSpawnEvent>;
    public readonly playerLeave:     CustomEventSignal<MC.PlayerLeaveEvent>;

    /// Package private
    public constructor(rawEvents: MC.Events) {
        super(rawEvents);
        this.blockBreak = new GluedEventSignalWithoutOptions(
            this.raw.blockBreak,
            (rawEv: MC.BlockBreakEvent) => {
                return {
                    block:                  new Block(rawEv.block),
                    brokenBlockPermutation: new BlockPermutation(rawEv.brokenBlockPermutation),
                    dimension:              new Dimension(rawEv.dimension),
                    player:                 new Player(rawEv.player)
                };
            });
        this.blockPlace = new GluedEventSignalWithoutOptions(
            this.raw.blockPlace,
            (rawEv: MC.BlockPlaceEvent) => {
                return {
                    block:     new Block(rawEv.block),
                    dimension: new Dimension(rawEv.dimension),
                    player:    new Player(rawEv.player)
                };
            });
        this.entityDie = new GluedEventSignalWithOptions(
            this.raw.entityDie,
            (rawEv: MC.EntityDieEvent) => {
                return {
                    damageCause: rawEv.damageCause,
                    deadEntity:  new Entity(rawEv.deadEntity)
                };
            },
            entityEventOptionsToRaw);
        this.itemUse = new GluedEventSignalWithoutOptions(
            this.raw.itemUse,
            (rawEv: MC.ItemUseEvent) => {
                return {
                    itemStack: new ItemStack(rawEv.item),
                    source:    rawEv.source.typeId === "minecraft:player"
                        ? new Player(rawEv.source as MC.Player)
                        : new Entity(rawEv.source)
                };
            });
        this.pistonActivate = new GluedEventSignalWithoutOptions(
            this.raw.pistonActivate,
            (rawEv: MC.PistonActivateEvent) => {
                return {
                    isExpanding: rawEv.isExpanding,
                    piston:      new Piston(rawEv.piston.block)
                };
            });
        this.worldInitialize = new GluedEventSignalWithoutOptions(
            this.raw.worldInitialize,
            (rawEv: MC.WorldInitializeEvent) => {
                return {
                    propertyRegistry: new PropertyRegistry(rawEv.propertyRegistry)
                };
            });
        this.ready       = new CustomEventSignal();
        this.playerSpawn = new CustomEventSignal();
        this.playerLeave = new CustomEventSignal();
    }
}

export interface ReadyEvent {}
