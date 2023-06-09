import { Block } from "./block.js";
import { Entity } from "./entity.js";
import { Player } from "./player.js";
import { Wrapper } from "./wrapper.js";
import type { ScriptEventSource } from "@minecraft/server";
import * as MC from "@minecraft/server";

export { ScriptEventSource };

export class ScriptEventCommandMessageAfterEvent extends Wrapper<MC.ScriptEventCommandMessageAfterEvent> {
    /** Package private: user code should not use this. */
    public constructor(rawEvent: MC.ScriptEventCommandMessageAfterEvent) {
        super(rawEvent);
    }

    public get id(): string {
        return this.raw.id;
    }

    public get initiator(): Entity|undefined {
        return this.raw.initiator
            ? (this.raw.initiator.typeId === "minecraft:player"
                ? new Player(this.raw.initiator as MC.Player)
                : new Entity(this.raw.initiator))
            : undefined;
    }

    public get message(): string {
        return this.raw.message;
    }

    public get sourceBlock(): Block|undefined {
        return this.raw.sourceBlock
            ? new Block(this.raw.sourceBlock)
            : undefined;
    }

    public get sourceEntity(): Entity|undefined {
        return this.raw.sourceEntity
            ? (this.raw.sourceEntity.typeId === "minecraft:player"
                ? new Player(this.raw.sourceEntity as MC.Player)
                : new Entity(this.raw.sourceEntity))
            : undefined;
    }

    public get sourceType(): ScriptEventSource {
        return this.raw.sourceType;
    }
}
