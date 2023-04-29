import { IEventSignal, CustomEventSignal, GluedEventSignalWithoutOptions,
         GluedEventSignalWithOptions } from "../event.js";
import { Block, BlockPermutation, BlockBreakEvent, BlockPlaceEvent } from "../block.js";
import { Dimension } from "../dimension.js";
import { Entity, ItemUseEvent, EntityDieEvent, EntityEventOptions,
         entityEventOptionsToRaw } from "../entity.js";
import { ItemStack } from "../item-stack.js";
import { Player, PlayerSpawnEvent } from "../player.js"
import * as MC from "@minecraft/server";

export class WorldEvents {
    public readonly blockBreak:  IEventSignal<BlockBreakEvent>;
    public readonly blockPlace:  IEventSignal<BlockPlaceEvent>;
    public readonly entityDie:   IEventSignal<EntityDieEvent, EntityEventOptions>;
    public readonly itemUse:     IEventSignal<ItemUseEvent>;
    /** An event that is fired when the world is fully loaded. */
    public readonly ready:       CustomEventSignal<ReadyEvent>;
    public readonly playerSpawn: CustomEventSignal<PlayerSpawnEvent>;
    public readonly playerLeave: CustomEventSignal<MC.PlayerLeaveEvent>;

    /// Package private
    public constructor(rawWorld: MC.World) {
        const rawEvents = rawWorld.events;

        this.blockBreak = new GluedEventSignalWithoutOptions(
            rawEvents.blockBreak,
            (rawEv: MC.BlockBreakEvent) => {
                return {
                    block:                  new Block(rawEv.block),
                    brokenBlockPermutation: new BlockPermutation(rawEv.brokenBlockPermutation),
                    dimension:              new Dimension(rawEv.dimension),
                    player:                 new Player(rawEv.player)
                };
            });
        this.blockPlace = new GluedEventSignalWithoutOptions(
            rawEvents.blockPlace,
            (rawEv: MC.BlockPlaceEvent) => {
                return {
                    block:     new Block(rawEv.block),
                    dimension: new Dimension(rawEv.dimension),
                    player:    new Player(rawEv.player)
                };
            });
        this.entityDie = new GluedEventSignalWithOptions(
            rawEvents.entityDie,
            (rawEv: MC.EntityDieEvent) => {
                return {
                    damageCause: rawEv.damageCause,
                    deadEntity:  new Entity(rawEv.deadEntity)
                };
            },
            entityEventOptionsToRaw);
        this.itemUse = new GluedEventSignalWithoutOptions(
            rawEvents.itemUse,
            (rawEv: MC.ItemUseEvent) => {
                return {
                    itemStack: new ItemStack(rawEv.item),
                    source:    rawEv.source.typeId === "minecraft:player"
                        ? new Player(rawEv.source as MC.Player)
                        : new Entity(rawEv.source)
                };
            });
        this.ready       = new CustomEventSignal();
        this.playerSpawn = new CustomEventSignal();
        this.playerLeave = new CustomEventSignal();
    }
}

export interface ReadyEvent {}
