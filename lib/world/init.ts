import { Wrapper } from "../wrapper.js";
import * as MC from "@minecraft/server";

export interface DynamicBooleanPropertyDefinition {
    type: "boolean";
}

export interface DynamicNumberPropertyDefinition {
    type: "number";
}

export interface DynamicStringPropertyDefinition {
    type: "string";
    maxLength: number;
}

export type DynamicPropertyDefinition =
    DynamicBooleanPropertyDefinition |
    DynamicNumberPropertyDefinition  |
    DynamicStringPropertyDefinition;

export interface DynamicPropertiesDefinition {
    [propId: string]: DynamicPropertyDefinition;
}

export interface EntityTypeDynamicPropertiesDefinition {
    [entityTypeId: string]: DynamicPropertiesDefinition;
}

export class PropertyRegistry extends Wrapper<MC.PropertyRegistry> {
    public registerEntityTypeDynamicProperties(
        propsForEachEntity: EntityTypeDynamicPropertiesDefinition): void {

        for (const [entityType, props] of Object.entries(propsForEachEntity)) {
            this.raw.registerEntityTypeDynamicProperties(
                propsToRaw(props),
                MC.EntityTypes.get(entityType));
        }
    }

    public registerWorldDynamicProperties(props: DynamicPropertiesDefinition): void {
        this.raw.registerWorldDynamicProperties(propsToRaw(props));
    }
}

function propsToRaw(props: DynamicPropertiesDefinition): MC.DynamicPropertiesDefinition {
    const raw = new MC.DynamicPropertiesDefinition();

    for (const [propId, def] of Object.entries(props)) {
        switch (def.type) {
            case "boolean":
                raw.defineBoolean(propId);
                break;

            case "number":
                raw.defineNumber(propId);
                break;

            case "string":
                raw.defineString(propId, def.maxLength);
                break;
        }
    }

    return raw;
}

export interface WorldInitializeAfterEvent {
    propertyRegistry: PropertyRegistry;
}
