# Release notes

## 2.1.0 -- not released yet

* New properties:
  * `World.prototype.getDimension`

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
