# Release notes

## 5.0.0 -- not released yet

* Updated for Minecraft Bedrock 1.20.71 (@minecraft/server 1.10.0-beta)
* Breaking changes:
  * `World.prototype.playSound()` has now been removed. Use
    `Dimension.prototype.playSound()` instead.
* Non-breaking changes:
  * `Dimension.prototype.playSound()`: new function

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
