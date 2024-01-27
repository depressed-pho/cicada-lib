import { BlockPermutation } from "../block/permutation.js";
import { map } from "../iterable.js";
import { EntityComponent } from "./component.js";
import * as I from "../inspect.js";
import * as PP from "../pprint.js";
import * as MC from "@minecraft/server";

export class EntityBreathable extends EntityComponent<MC.EntityBreathableComponent> implements I.HasCustomInspection {
    public static readonly typeId = "minecraft:breathable";

    public set airSupply(value: number) {
        this.raw.setAirSupply(value);
    }

    public get breatheBlocks(): IterableIterator<BlockPermutation> {
        return map(this.raw.getBreatheBlocks(), raw => {
            return new BlockPermutation(raw);
        });
    }

    public get breathesAir(): boolean {
        return this.raw.breathesAir;
    }

    public get breathesLava(): boolean {
        return this.raw.breathesLava;
    }

    public get breathesSolids(): boolean {
        return this.raw.breathesSolids;
    }

    public get breathesWater(): boolean {
        return this.raw.breathesWater;
    }

    public get generatesBubbles(): boolean {
        return this.raw.generatesBubbles;
    }

    public get inhaleTime(): number {
        return this.raw.inhaleTime;
    }

    public get nonBreatheBlocks(): IterableIterator<BlockPermutation> {
        return map(this.raw.getNonBreatheBlocks(), raw => {
            return new BlockPermutation(raw);
        });
    }

    public get suffocateTime(): number {
        return this.raw.suffocateTime;
    }

    public get totalSupply(): number {
        return this.raw.totalSupply;
    }

    /// @internal
    public [I.customInspectSymbol](inspect: (value: any, opts?: I.InspectOptions) => PP.Doc,
                                   stylise: (token: PP.Doc, type: I.TokenType) => PP.Doc,
                                   opts: Required<I.InspectOptions>): PP.Doc {
        const obj: any = {
            inhaleTime:    this.inhaleTime,
            suffocateTime: this.suffocateTime,
            totalSupply:   this.totalSupply,
        };
        if (this.breathesAir)
            obj.breathesAir = true;
        if (this.breathesLava)
            obj.breathesLava = true;
        if (this.breathesSolids)
            obj.breathesSolids = true;
        if (this.breathesWater)
            obj.breathesWater = true;
        if (this.generatesBubbles)
            obj.generatesBubbles = true;

        // Displaying the entire BlockPermutation for each block would be
        // too verbose. Do it when showHidden is enabled, otherwise only
        // show their block IDs.
        if (this.raw.getBreatheBlocks().length > 0) {
            if (opts.showHidden)
                obj.breatheBlocks = Array.from(this.breatheBlocks);
            else
                obj.breatheBlocks = Array.from(this.breatheBlocks).map(perm => perm.typeId);
        }
        if (this.raw.getNonBreatheBlocks().length > 0) {
            if (opts.showHidden)
                obj.nonBreatheBlocks = Array.from(this.nonBreatheBlocks);
            else
                obj.nonBreatheBlocks = Array.from(this.nonBreatheBlocks).map(perm => perm.typeId);
        }

        return PP.spaceCat(
            stylise(PP.text("EntityBreathable"), I.TokenType.Class),
            inspect(obj));
    }
}
