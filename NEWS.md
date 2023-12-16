# Release notes

## 3.0.0 -- not released yet

* Updated for Minecraft Bedrock 1.20.50 (@minecraft/server 1.8.0-beta).
* Switched to the official TypeScript type declarations.
* Breaking changes:
  * The constructor of `Thread` no longer takes an async generator
    function. It is now an abstract class that expects subclasses to
    override `run()`.
  * Threads no longer start automatically. In order to start them, call
    `start()`.
* New properties:
  * `Block.prototype.getItemStack`
  * `Block.prototype.type` setter
  * `BlockPermutation.prototype.equals`
  * `BlockPermutation.prototype.tags`
  * `Dimension.prototype.spawnItem`
  * `ItemStack.prototype.tags`
  * `World.prototype.getDimension`
* Added `lib/sync/mpsc.ts`
* Added `lib/sync/notify.ts`
* Added `lib/sync/watch.ts`

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
