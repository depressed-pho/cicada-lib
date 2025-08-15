import { Block } from "./block.js";
import { Entity } from "./entity.js";
import { ItemStack } from "./item/stack.js";
import { Wrapper } from "./wrapper.js";
import { map } from "./iterable.js";
import { Vector3, WeatherType, WorldSoundOptions } from "@minecraft/server";
import { NumberRange } from "@minecraft/common";
import * as I from "./inspect.js";
import * as PP from "./pprint.js";
import * as MC from "@minecraft/server";

export { WeatherType, WorldSoundOptions };

export class Dimension extends Wrapper<MC.Dimension> implements I.HasCustomInspection {
    public get heightRange(): NumberRange {
        return this.raw.heightRange;
    }

    public get id(): string {
        return this.raw.id;
    }

    /** Get the block at the given location. This function never throws. */
    public getBlock(location: MC.Vector3): Block|undefined {
        try {
            const raw = this.raw.getBlock(location);
            return raw ? new Block(raw) : undefined;
        }
        catch (e) {
            if (e instanceof MC.LocationInUnloadedChunkError ||
                e instanceof MC.LocationOutOfWorldBoundariesError)
                return undefined;
            else
                throw e;
        }
    }

    public getEntities(opts?: MC.EntityQueryOptions): IterableIterator<Entity> {
        return map(this.raw.getEntities(opts), raw => {
            return new Entity(raw);
        });
    }

    /* FIXME: Uncomment this when getWeather() is released.
    public getWeather(): WeatherType {
        return this.raw.getWeather();
    }
    */

    public playSound(soundId: string, location: Vector3, soundOptions?: WorldSoundOptions): void {
        this.raw.playSound(soundId, location, soundOptions);
    }

    public setWeather(weatherType: WeatherType, duration?: number): void {
        this.raw.setWeather(weatherType, duration);
    }

    public spawnEntity(identifier: string, location: Vector3): Entity {
        return new Entity(this.raw.spawnEntity/*<string>*/(identifier, location));
    }

    public spawnItem(itemStack: ItemStack, location: Vector3): Entity {
        return new Entity(this.raw.spawnItem(itemStack.raw, location));
    }

    /// @internal
    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                                  stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc): PP.Doc {
        //const self     = this;
        const obj: any = {
            id:          this.id,
            heightRange: this.heightRange,
            /* FIXME: Uncomment this when getWeather() is released.
            get weather(): WeatherType {
                // This method is unavailable in read-only mode, although
                // it doesn't make sense.
                return self.getWeather();
            }
            */
        };
        return PP.spaceCat(
            stylise(PP.text("Dimension"), I.TokenType.Class),
            inspect(obj));
    }
}
