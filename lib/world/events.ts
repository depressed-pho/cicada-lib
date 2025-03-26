import { IEventSignal, CustomEventSignal, GluedEventSignalWithoutOptions,
         GluedEventSignalWithOptions } from "../event.js";
import { Block, BlockPermutation, PlayerBreakBlockAfterEvent,
         PlayerPlaceBlockAfterEvent, PlayerBreakBlockBeforeEvent } from "../block.js";
import { PistonActivateAfterEvent } from "../block/minecraft/piston.js";
import { Dimension } from "../dimension.js";
import { Entity, EntityDieAfterEvent, EntityEventOptions,
         entityEventOptionsToRaw } from "../entity.js";
import { ItemStack, ItemUseAfterEvent, ItemUseBeforeEvent } from "../item.js";
import { ChatSendBeforeEvent, Player,
         PlayerLeaveBeforeEvent, PlayerSpawnAfterEvent } from "../player.js"
import { Wrapper } from "../wrapper.js";
import * as MC from "@minecraft/server";

export class WorldAfterEvents extends Wrapper<MC.WorldAfterEvents> {
    public readonly playerBreakBlock: IEventSignal<PlayerBreakBlockAfterEvent>;
    public readonly playerPlaceBlock: IEventSignal<PlayerPlaceBlockAfterEvent>;
    public readonly entityDie:        IEventSignal<EntityDieAfterEvent, EntityEventOptions>;
    public readonly itemUse:          IEventSignal<ItemUseAfterEvent>;
    public readonly pistonActivate:   IEventSignal<PistonActivateAfterEvent>;
    public readonly worldLoad:        IEventSignal<MC.WorldLoadAfterEvent>;
    /** An event that is fired when the world is fully loaded. */
    public readonly ready:            CustomEventSignal<ReadyAfterEvent>;
    public readonly playerSpawn:      CustomEventSignal<PlayerSpawnAfterEvent>;
    public readonly playerLeave:      CustomEventSignal<MC.PlayerLeaveAfterEvent>;

    /// Package private
    public constructor(rawEvents: MC.WorldAfterEvents) {
        super(rawEvents);
        this.playerBreakBlock = new GluedEventSignalWithoutOptions(
            this.raw.playerBreakBlock,
            (rawEv: MC.PlayerBreakBlockAfterEvent) => {
                return {
                    block:                  new Block(rawEv.block),
                    dimension:              new Dimension(rawEv.dimension),
                    brokenBlockPermutation: new BlockPermutation(rawEv.brokenBlockPermutation),
                    player:                 new Player(rawEv.player),
                    ...(rawEv.itemStackAfterBreak
                        ? {itemStackAfterBreak: new ItemStack(rawEv.itemStackAfterBreak)}
                        : {}),
                    ...(rawEv.itemStackBeforeBreak
                        ? {itemStackBeforeBreak: new ItemStack(rawEv.itemStackBeforeBreak)}
                        : {}),
                };
            });
        this.playerPlaceBlock = new GluedEventSignalWithoutOptions(
            this.raw.playerPlaceBlock,
            (rawEv: MC.PlayerPlaceBlockAfterEvent) => {
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
                    damageSource: rawEv.damageSource,
                    deadEntity:   new Entity(rawEv.deadEntity)
                };
            },
            entityEventOptionsToRaw);
        this.itemUse = new GluedEventSignalWithoutOptions(
            this.raw.itemUse,
            (rawEv: MC.ItemUseAfterEvent) => {
                return {
                    itemStack: new ItemStack(rawEv.itemStack),
                    source:    new Player(rawEv.source)
                };
            });
        this.pistonActivate = new GluedEventSignalWithoutOptions(
            this.raw.pistonActivate,
            (rawEv: MC.PistonActivateAfterEvent) => new PistonActivateAfterEvent(rawEv));
        this.worldLoad   = this.raw.worldLoad;
        this.ready       = new CustomEventSignal();
        this.playerSpawn = new CustomEventSignal();
        this.playerLeave = new CustomEventSignal();
    }
}

export class WorldBeforeEvents extends Wrapper<MC.WorldBeforeEvents> {
    public readonly chatSend: IEventSignal<ChatSendBeforeEvent>;
    public readonly itemUse: IEventSignal<ItemUseBeforeEvent>;
    public readonly playerBreakBlock: IEventSignal<PlayerBreakBlockBeforeEvent>;
    public readonly playerLeave: IEventSignal<PlayerLeaveBeforeEvent>;

    /// Package private
    public constructor(rawEvents: MC.WorldBeforeEvents) {
        super(rawEvents);
        this.chatSend = new GluedEventSignalWithoutOptions(
            this.raw.chatSend,
            (rawEv: MC.ChatSendBeforeEvent) => new ChatSendBeforeEvent(rawEv));
        this.itemUse = new GluedEventSignalWithoutOptions(
            this.raw.itemUse,
            (rawEv: MC.ItemUseBeforeEvent) => new ItemUseBeforeEvent(rawEv));
        this.playerBreakBlock = new GluedEventSignalWithoutOptions(
            this.raw.playerBreakBlock,
            (rawEv: MC.PlayerBreakBlockBeforeEvent) => new PlayerBreakBlockBeforeEvent(rawEv));
        this.playerLeave = new GluedEventSignalWithoutOptions(
            this.raw.playerLeave,
            (rawEv: MC.PlayerLeaveBeforeEvent) => {
                return {
                    player: new Player(rawEv.player)
                };
            });
    }
}

export interface ReadyAfterEvent {}
