import { IEventSignal, CustomEventSignal, GluedEventSignal } from "../event.js";
import { Block, BlockPermutation, BlockBreakEvent, BlockPlaceEvent } from "../block.js";
import { Dimension } from "../dimension.js";
import { Entity, ItemUseEvent } from "../entity.js";
import { ItemStack } from "../item-stack.js";
import { Player, PlayerSpawnEvent } from "../player.js"
import * as MC from "@minecraft/server";

export class WorldEvents {
    public readonly blockBreak:  IEventSignal<BlockBreakEvent>;
    public readonly blockPlace:  IEventSignal<BlockPlaceEvent>;
    public readonly itemUse:     IEventSignal<ItemUseEvent>;
    /** An event that is fired when the world is fully loaded. */
    public readonly ready:       CustomEventSignal<ReadyEvent>;
    public readonly playerSpawn: CustomEventSignal<PlayerSpawnEvent>;
    public readonly playerLeave: CustomEventSignal<MC.PlayerLeaveEvent>;

    /// Package private
    public constructor(rawWorld: MC.World) {
        const rawEvents = rawWorld.events;

        this.blockBreak = new GluedEventSignal(rawEvents.blockBreak, (rawEv: MC.BlockBreakEvent) => {
            return {
                block:                  new Block(rawEv.block),
                brokenBlockPermutation: new BlockPermutation(rawEv.brokenBlockPermutation),
                dimension:              new Dimension(rawEv.dimension),
                player:                 new Player(rawEv.player)
            };
        });
        this.blockPlace = new GluedEventSignal(rawEvents.blockPlace, (rawEv: MC.BlockPlaceEvent) => {
            return {
                block:     new Block(rawEv.block),
                dimension: new Dimension(rawEv.dimension),
                player:    new Player(rawEv.player)
            };
        });
        this.itemUse = new GluedEventSignal(rawEvents.itemUse, (rawEv: MC.ItemUseEvent) => {
            return {
                itemStack: new ItemStack(rawEv.itemStack),
                source:    rawEv.source instanceof MC.Player
                    ? new Player(rawEv.source)
                    : new Entity(rawEv.source)
            };
        });
        this.ready       = new CustomEventSignal();
        this.playerSpawn = new CustomEventSignal();
        this.playerLeave = new CustomEventSignal();
    }
}

export interface ReadyEvent {}
