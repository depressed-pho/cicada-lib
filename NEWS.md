# Release notes

## 12.0.0 -- 2025-08-15

Starting from v12.0.0, cicada-lib is released in two flavours: "stable" and
"beta". The stable branch which resides as `stable` branch in the
repository is now released with odd major version numbers, while the beta
branch `master` is released with even ones.

The `stable` branch is for the stable scripting API of Minecraft
Bedrock. The `master` branch is for the beta API found in stable releases
as opposed to preview/beta releases.

If you want to use the stable branch, you need to declare a dependency with
a branch name:

```
"dependencies": {
  "cicada-lib": "github:depressed-pho/cicada-lib#stable"
}
```

There are no actual changes between v11.1.0 and v12.0.0 aside from the
versioning policy change.

## 11.1.0 -- 2025-08-09

Updated for Minecraft Bedrock 1.21.100 (@minecraft/server 2.2.0-beta)

Non-breaking changes:
* `Block.prototype.generateLoot` has been added.
* `BlockPermutation.prototype.generateLoot` has been added.
* `BlockType.prototype.generateLoot` has been added.
* `Container.prototype.slot` has been added.
* `Entity.prototype.generateLoot` has been added.
* `Entity.prototype.type` has been added.
* `EntityType` has been added.
* `EntityEquipment.prototype.slot` has been added.
* `ItemStack` now mixes `HasDynamicProperties` in.
* `ItemStack.prototype.rawLore` has been added.
* `ItemBag` constructor now accepts `stacks?: Iterable<ItemStack>` as an
  argument.
* `WorldAfterEvents.prototype.playerHotbarSelectedSlotChange` has been
  added.
* `IHasDynamicProperties` now has a new method `setDynamicProperties`.

## 11.0.0 -- 2025-07-03

Breaking changes:
* The optional parameter `cheatsRequired` for the `@command()` decorator
  was intended to be defaulted to `false` but it was accidentally defaulted
  to `true`. It's now defaulted to `false`.

## 10.2.0 -- 2025-07-02

Non-breaking changes:
* A shim for `Set.prototype.union` has been added as `shims/set-union.ts`.

## 10.1.1 -- 2025-07-01

Fix `ModalFormData` from `ui.ts` failing to extract the resulting
values. The code was supposed to be updated for MCBE 1.21.90 in cicada-lib
10.1.0 but the update was flawed.

## 10.1.0 -- 2025-06-19

Updated for Minecraft Bedrock 1.21.90 (@minecraft/server 2.1.0-beta)

Breaking changes:
* `Player.prototype.isOp` getter/setter has been removed because their
  corresponding native methods have also been removed.

Non-breaking changes:
* `Entity.prototype.exhaustion` has been added.
* `Entity.prototype.hunger` has been added.
* `Entity.prototype.saturation` has been added.
* `Player.prototype.permissionLevel` has been added.

## 10.0.0 -- 2025-06-19

Breaking changes:
* The old `command.ts` has been renamed to `command/legacy.ts`.
* Replaced `command.ts` with a decorator-based framework for defining
  native custom commands appeared in MCBE 1.21.80.

## 9.1.0 -- 2025-06-16

Non-breaking changes:
* `SystemBeforeEvents.prototype.startup` has been added.

## 9.0.0 -- 2025-06-16

Updated for Minecraft Bedrock 1.21.84 (@minecraft/server 2.0.0-beta)

Breaking changes - the following functions now take options as an object
instead of positional arguments:
* `ModalFormData.prototype.dropdown`
* `ModalFormData.prototype.slider`
* `ModalFormData.prototype.textField`
* `ModalFormData.prototype.toggle`

Pre-native custom commands (`command.ts`) is now considered deprecated
because MCBE natively allows addons to register custom commands as of
1.21.80. We don't remove it immediately, but we may do it in the future.

## 8.0.0 -- 2025-03-27

Updated for Minecraft Bedrock 1.21.70 (@minecraft/server 2.0.0-beta)

Breaking changes:
* `WorldAfterEvents.prototype.worldInitialize` has been renamed to
  `worldLoad`.

Non-breaking changes:
* `ActionFormData.prototype.divider` has been added.
* `ActionFormData.prototype.header` has been added.
* `ActionFormData.prototype.label` has been added.
* `ModalFormData.prototype.divider` has been added.
* `ModalFormData.prototype.header` has been added.
* `ModalFormData.prototype.label` has been added.
* Added `sync/latch.ts`.

## 7.1.0 -- 2025-03-26

* Player sessions are now guaranteed to be created before any of
  user-defined `playerSpawn` after-event callbacks are invoked. Previously
  this wasn't guaranteed.
* Likewise, player sessions are now guaranteed to be destroyed after any of
  user-defined `playerLeave` after-event callbacks are invoked. Previously
  this wasn't guaranteed either.
* `ready` after-event is now trigerred right before the first `playerSpawn`
  after-event is trigerred. Previously its implementation relied on an
  undocumented behaviour of the game.

## 7.0.0 -- 2025-02-17

* Updated for Minecraft Bedrock 1.21.60 (@minecraft/server 1.18.0-beta)
* Breaking changes:
  * `BlockType.prototype.canBeWaterlogged` has been removed.
* Non-breaking changes:
  * `Block.prototype.canBeDestroyedByLiquidSpread` has been added.
  * `Block.prototype.canContainLiquid` has been added.
  * `Block.prototype.isLiquidBlocking` has been added.
  * `Block.prototype.liquidSpreadCausesSpawn` has been added.
  * `Block.prototype.liquidCanFlowFromDirection` has been added.
  * `Block.prototype.isWaterlogged` now has a setter. Previously the
    property only had a getter.
  * `BlockPermutation.prototype.canBeDestroyedByLiquidSpread` has been added.
  * `BlockPermutation.prototype.isLiquidBlocking` has been added.
  * `BlockPermutation.prototype.liquidSpreadCausesSpawn` has been added.

## 6.1.0 -- 2024-12-08

* Non-breaking changes:
  * `Block` now has a new getter `inventory` which may return a
    `BlockInventory` object, which is a subclass of `Container`. The getter
    returns `undefined` if the block doesn't have a block component
    `minecraft:inventory`.
* Bug fixes:
  * `Container.prototype.entries` and many other methods of the class
    completely stopped working, and it turned out to be a schrödinbug. That
    is, I swear they worked in the past but I noticed the code should have
    never worked in the first place...

## 6.0.4 -- 2024-12-04

* Updated for Minecraft Bedrock 1.21.50 (@minecraft/server 1.17.0-beta)

## 6.0.3 -- 2024-10-26

* Updated for Minecraft Bedrock 1.21.40 (@minecraft/server 1.16.0-beta)

## 6.0.2 -- 2024-09-19

* Updated for Minecraft Bedrock 1.21.30 (@minecraft/server 1.15.0-beta)

## 6.0.1 -- 2024-08-19

* Updated for Minecraft Bedrock 1.21.21 (@minecraft/server 1.14.0-beta)

## 6.0.0 -- 2024-06-21

* Updated for Minecraft Bedrock 1.21 (@minecraft/server 1.12.0-beta)
* Breaking changes:
  * `Player.prototype.selectedSlot` has been renamed to
    `Player.prototype.selectedSlotIndex`.
* Non-breaking changes:
  * `pprint/colours.js` now exports two missing functions `darkTeal()` and
    `purple()`.
  * `inspect.js` now pretty-prints `BigInt` primitive values with a
    slightly different colour from the one used for `number`.
* Bug fixes:
  * `delay()` from `delay.js` now correctly converts seconds into ticks.

## 5.0.0 -- 2024-04-25

* Updated for Minecraft Bedrock 1.20.80 (@minecraft/server 1.11.0-beta)
* Breaking changes:
  * `World.prototype.playSound()` has now been removed. Use
    `Dimension.prototype.playSound()` instead.
* Non-breaking changes:
  * `Dimension.prototype.playSound()`: new function
  * `ModalFormData.submitButton`

## 4.0.0 -- 2024-02-28

* Updated for Minecraft Bedrock 1.20.60 (@minecraft/server 1.9.0-beta)
* Breaking changes:
  * Replaced all occurences of word "equipments" with "equipment". You know
    English isn't my native language LOL.
  * Moved `setTimeout()` and its family from `delay.js` to
    `shims/timeout.js`.
* Non-breaking changes:
  * `delay.js` now exports a new function `delayTicks()`.
  * Yielding values from a `Thread` now inserts a 1 tick delay when it
    exceeds the time budget per tick. This turned out to be necessary due
    to an apparent change in how scheduled promises are executed.

## 3.0.0 -- 2024-01-28

* Updated for Minecraft Bedrock 1.20.50 (@minecraft/server 1.8.0-beta).
* Switched to the official TypeScript type declarations.
* Breaking changes:
  * The constructor of `Thread` no longer takes an async generator
    function. It is now an abstract class that expects subclasses to
    override `run()`.
  * Threads no longer start automatically. In order to start them, call
    `start()`.
  * The setter `Block.prototype.type` no longer accepts `string`. Use the
    `Block.prototype.typeId` setter for that.
  * `gold` from `pprint/colours.ts` has been renamed to `orange` to reflect the official name.
  * `aqua` from `pprint/colours.ts` has been renamed to `lightBlue`.
  * `lightPurple` from `pprint/colours.ts` has been renamed to `pink`.
  * `minecoinGold` from `pprint/colours.ts` has been renamed to `gold`.
  * `strikethrough` from `pprint/styles.ts` has been removed because it's non-functional.
  * `underline` from `pprint/styles.ts` has been removed because it's non-functional.
  * UI builder methods from `ui.ts` now take keys of any types to identify
    values in `FormResponse`.
  * `ItemEnchantments` from `item.ts` no longer implements
    `Set<Enchantment>`. It now implements `Map<EnchantmentType, number>`
    where `number` is the enchantment level.
* Non-breaking changes:
  * The constructor of `ItemStack` now accepts optional block states. This
    only works for items that have corresponding blocks.
* New properties:
  * `Block.prototype.getItemStack()`
  * `Block.prototype.isAir`
  * `Block.prototype.isLiquid`
  * `Block.prototype.isSolid`
  * `Block.prototype.isValid`
  * `Block.prototype.isWaterlogged`
  * `Block.prototype.typeId` setter
  * `BlockPermutation.prototype.equals()`
  * `BlockPermutation.prototype.tags`
  * `Dimension.prototype.spawnItem()`
  * `Entity.prototype.matches()`
  * `Location.prototype.floor()`
  * `ItemStack.prototype.tags`
  * `Player.prototype.gameMode`
  * `Player.prototype.getSession()`
  * `Player.prototype.isOp`
  * `Timer.prototype.reset()`
  * `World.prototype.getDimension()`
  * `World.prototype.playSound()`
* Added `hasher.ts`
* Added `sync/mpsc.ts`
* Added `sync/notify.ts`
* Added `sync/watch.ts`
* `pprint/colours.ts` now additionally exports `warmLightGray`,
  `coolLightGray`, `darkBrown`, `darkerRed`, `brown`, `darkGold`, `aqua`,
  `darkTeal`, and `purple`.

## 2.0.0 -- 2023-09-17

* Updated for Minecraft Bedrock 1.20.10 (@minecraft/server 1.3.0).
* New properties:
  * `Block.prototype.offset`
  * `Entity.prototype.getBlockFromViewDirection`
  * `Player.prototype.console`
  * `World.prototype.afterEvents`
  * `World.prototype.beforeEvents`
  * `System.prototype.afterEvents`
  * `System.prototype.beforeEvents`
* Not only `Player`, now `World` also supports `getDynamicProperty`,
  `setDynamicProperty`, `removeDynamicProperty`, `getPreferences`, and
  `setPreferences`.
* Functions provided by `lib/delay.ts` now catch unhandled exceptions and
  print it to `console` if callbacks throw. This works even if they are
  async functions.
* Removed `lib/event-emitter.ts`.
* Renamed `lib/enchantment.ts` to `lib/item/enchantment.ts`.
* Renamed `lib/item-stack.ts` to `lib/item/stack.ts`.
* Renamed `lib/octet-stream.ts` to `lib/cic-ascii.ts`.
* Added `lib/block/minecraft/piston.ts`.
* Added `lib/lz4.ts`.
* Added `lib/parser.ts`.
* `World` and `System` are no longer subclasses of `EventEmitter`. We
  figured that adopting the `EventEmitter` API caused a performance issue
  because we had to subscribe to every event the API supports.
* Updated for Minecraft Bedrock 1.19.70:
  * Removed `BlockLocation` from `lib/location.ts`.
  * The constructor for `ItemStack` no longer accepts `data`.
  * Removed `ItemStack.prototype.data`.

## 1.0.0 -- 2023-01-04

* Initial release.
