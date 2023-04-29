import { Block } from "./block.js";
import { Entity } from "./entity.js";
import { Player } from "./player.js";
import { MessageSourceType } from "@minecraft/server";
import * as MC from "@minecraft/server";

export { MessageSourceType };

export class ScriptEventCommandMessageEvent {
    readonly #event: MC.ScriptEventCommandMessageEvent;

    /** The constructor is public only because of a language
     * limitation. User code must never call it directly. */
    public constructor(rawEvent: MC.ScriptEventCommandMessageEvent) {
        this.#event = rawEvent;
    }

    public get id(): string {
        return this.#event.id;
    }

    public get initiator(): Entity|undefined {
        return this.#event.initiator
            ? (this.#event.initiator.typeId === "minecraft:player"
                ? new Player(this.#event.initiator as MC.Player)
                : new Entity(this.#event.initiator))
            : undefined;
    }

    public get message(): string {
        return this.#event.message;
    }

    public get sourceBlock(): Block|undefined {
        return this.#event.sourceBlock
            ? new Block(this.#event.sourceBlock)
            : undefined;
    }

    public get sourceEntity(): Entity|undefined {
        return this.#event.sourceEntity
            ? (this.#event.sourceEntity.typeId === "minecraft:player"
                ? new Player(this.#event.sourceEntity as MC.Player)
                : new Entity(this.#event.sourceEntity))
            : undefined;
    }

    public get sourceType(): MessageSourceType {
        return this.#event.sourceType;
    }
}
