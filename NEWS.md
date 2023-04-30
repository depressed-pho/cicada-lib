# Release notes

## 2.0.0 -- not released yet

* New properties:
  * `Entity.prototype.getBlockFromViewDirection`
  * `Player.prototype.console`
  * `World.prototype.events`
  * `System.prototype.events`
* Removed `lib/event-emitter.ts`.
* Renamed `lib/enchantment.ts` to `lib/item/enchantment.ts`.
* Renamed `lib/item-stack.ts` to `lib/item/stack.ts`.
* Added `lib/block/minecraft/piston.ts`.
* `World` and `System` are no longer subclasses of `EventEmitter`. We
  figured that adopting the `EventEmitter` API caused a performance issue
  because we had to subscribe to every event the API supports.
* Updated for Minecraft Bedrock 1.19.70:
  * Removed `BlockLocation` from `lib/location.ts`.
  * The constructor for `ItemStack` no longer accepts `data`.
  * Removed `ItemStack.prototype.data`.

## 1.0.0 -- 2023-01-04

* Initial release.
