import { Player } from "./player.js";
import * as UI from "@minecraft/server-ui";

export {
    ActionFormResponse,
    FormCancelationReason,
    FormResponse,
    MessageFormResponse,
    ModalFormResponse
} from "@minecraft/server-ui";

export class ActionFormData {
    readonly #raw: UI.ActionFormData;

    public constructor() {
        this.#raw = new UI.ActionFormData();
    }

    body(bodyText: string): ActionFormData {
        this.#raw.body(bodyText);
        return this;
    }

    button(text: string, iconPath?: string): ActionFormData {
        this.#raw.button(text, iconPath);
        return this;
    }

    show(player: Player): Promise<UI.ActionFormResponse> {
        return this.#raw.show(player.raw);
    }

    title(titleText: string): ActionFormData {
        this.#raw.title(titleText);
        return this;
    }
}

export class MessageFormData {
    readonly #raw: UI.MessageFormData;

    public constructor() {
        this.#raw = new UI.MessageFormData();
    }

    body(bodyText: string): MessageFormData {
        this.#raw.body(bodyText);
        return this;
    }

    button1(text: string): MessageFormData {
        this.#raw.button1(text);
        return this;
    }

    button2(text: string): MessageFormData {
        this.#raw.button2(text);
        return this;
    }

    show(player: Player): Promise<UI.MessageFormResponse> {
        return this.#raw.show(player.raw);
    }

    title(titleText: string): MessageFormData {
        this.#raw.title(titleText);
        return this;
    }
}

export class ModalFormData {
    readonly #raw: UI.ModalFormData;

    public constructor() {
        this.#raw = new UI.ModalFormData();
    }

    dropdown(label: string, options: string[], defaultValueIndex?: number): ModalFormData {
        this.#raw.dropdown(label, options, defaultValueIndex);
        return this;
    }

    icon(iconPath: string): ModalFormData {
        this.#raw.icon(iconPath);
        return this;
    }

    show(player: Player): Promise<UI.ModalFormResponse> {
        return this.#raw.show(player.raw);
    }

    slider(
        label: string,
        minimumValue: number,
        maximumValue: number,
        valueStep: number,
        defaultValue?: number,
    ): ModalFormData {
        this.#raw.slider(label, minimumValue, maximumValue, valueStep, defaultValue);
        return this;
    }

    textField(label: string, placeholderText: string, defaultValue?: string): ModalFormData {
        this.#raw.textField(label, placeholderText, defaultValue);
        return this;
    }

    title(titleText: string): ModalFormData {
        this.#raw.title(titleText);
        return this;
    }

    toggle(label: string, defaultValue?: boolean): ModalFormData {
        this.#raw.toggle(label, defaultValue);
        return this;
    }
}
