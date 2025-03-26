import { Wrapper } from "./wrapper.js";
import * as MC from "@minecraft/server";

/// @internal
export abstract class Component<T extends MC.Component> extends Wrapper<T> {
    public get typeId(): string {
        return this.raw.typeId;
    }

    public get isValid(): boolean {
        return this.raw.isValid;
    }
}

/// @internal
export interface IWrapperHavingComponents {
    raw: {
        getComponent(componentId: string): any
    };
}

/** @internal We should be able to reduce the repetitive pattern in wrapper
 * classes having components like this:
 *
 * class Entity extends Wrapper<MC.Entity> {
 *     @component("minecraft:inventory", EntityInventory)
 *     readonly inventory: EntityInventory|undefined;
 * }
 *
 * ...but we can't, because MCBE currently uses an old version of QuickJS
 * that doesn't support ES2023.
 */
export function component<Class extends IWrapperHavingComponents, Field>(componentId: string,
                                                                         wrapperClass: new (raw: any) => Field
                                                                        ):
    (target: undefined, context: ClassFieldDecoratorContext<Class, Field|undefined>) =>
        void|(() => Field|undefined) {

    return (_target: undefined, context: ClassFieldDecoratorContext<Class, Field|undefined>) => {
        if (context.static)
            throw new TypeError(
                `A field decorated with @component must not be static: ${String(context.name)}`);

        return function (this: Class) {
            // We could cache wrapped components in a WeakMap but that's
            // probably slower than this.
            const raw = this.raw.getComponent(componentId);
            return raw ? new wrapperClass(raw) : undefined;
        };
    };
}
