import { Block } from "./block.js";
import { BlockPermutation } from "./block/permutation.js";
import { BlockType } from "./block/type.js";
import { Entity } from "./entity.js";
import { EntityType } from "./entity/type.js";
import { ItemBag } from "./item/bag.js";
import { ItemStack } from "./item/stack.js";
import { Wrapper } from "./wrapper.js";
import * as MC from "@minecraft/server";

/// @internal
export class LootTableManager extends Wrapper<MC.LootTableManager> {
    static #instance?: LootTableManager;

    public static get instance(): LootTableManager {
        if (!this.#instance) {
            this.#instance = new LootTableManager(MC.world.getLootTableManager());
        }
        return this.#instance;
    }

    public generateLoot(block: Block, tool?: ItemStack): ItemBag|null;
    public generateLoot(blockPerm: BlockPermutation, tool?: ItemStack): ItemBag|null;
    public generateLoot(blockType: BlockType, tool?: ItemStack): ItemBag|null;
    public generateLoot(entity: Entity, tool?: ItemStack): ItemBag;
    public generateLoot(entityType: EntityType, tool?: ItemStack): ItemBag;

    public generateLoot(target: any, tool?: ItemStack): ItemBag|null {
        let rawStacks: MC.ItemStack[]|undefined;
        let isNullable: boolean;
        if (target instanceof Block) {
            rawStacks  = LootTableManager.instance.raw.generateLootFromBlock(target.raw, tool?.raw);
            isNullable = true;
        }
        else if (target instanceof BlockPermutation) {
            rawStacks  = LootTableManager.instance.raw.generateLootFromBlockPermutation(target.raw, tool?.raw);
            isNullable = true;
        }
        else if (target instanceof BlockType) {
            rawStacks  = LootTableManager.instance.raw.generateLootFromBlockType(target.raw, tool?.raw);
            isNullable = true;
        }
        else if (target instanceof Entity) {
            rawStacks  = LootTableManager.instance.raw.generateLootFromEntity(target.raw, tool?.raw);
            isNullable = false;
        }
        else if (target instanceof EntityType) {
            rawStacks  = LootTableManager.instance.raw.generateLootFromEntityType(target.raw, tool?.raw);
            isNullable = false;
        }
        else {
            throw new TypeError(`Unknown target type: ${target}`);
        }

        if (rawStacks) {
            const bag = new ItemBag();
            for (const rawStack of rawStacks) {
                bag.add(new ItemStack(rawStack));
            }
            return bag;
        }
        else if (isNullable) {
            return null;
        }
        else {
            throw new Error(
                "Something went wrong: LootTableManager.prototype.generateLootFrom*" +
                ` should have thrown an exception but it instead returned ${String(rawStacks)}`);
        }
    }
}
