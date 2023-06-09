import { Player } from "./player.js";
import { Wrapper } from "./wrapper.js";
import { RawMessage } from "@minecraft/server";
import * as MC from "@minecraft/server";
import * as UI from "@minecraft/server-ui";

export {
    ActionFormResponse,
    FormCancelationReason,
    FormResponse,
    MessageFormResponse,
    ModalFormResponse
} from "@minecraft/server-ui";

export class ActionFormData extends Wrapper<UI.ActionFormData> {
    public constructor() {
        super(new UI.ActionFormData());
    }

    body(bodyText: RawMessage | string): ActionFormData {
        this.raw.body(bodyText);
        return this;
    }

    button(text: MC.RawMessage, iconPath?: string): ActionFormData {
        this.raw.button(text, iconPath);
        return this;
    }

    show(player: Player): Promise<UI.ActionFormResponse> {
        return this.raw.show(player.rawPlayer);
    }

    title(titleText: MC.RawMessage | string): ActionFormData {
        this.raw.title(titleText);
        return this;
    }
}

export class MessageFormData extends Wrapper<UI.MessageFormData> {
    public constructor() {
        super(new UI.MessageFormData());
    }

    body(bodyText: MC.RawMessage | string): MessageFormData {
        this.raw.body(bodyText);
        return this;
    }

    button1(text: MC.RawMessage | string): MessageFormData {
        this.raw.button1(text);
        return this;
    }

    button2(text: MC.RawMessage | string): MessageFormData {
        this.raw.button2(text);
        return this;
    }

    show(player: Player): Promise<UI.MessageFormResponse> {
        return this.raw.show(player.rawPlayer);
    }

    title(titleText: MC.RawMessage | string): MessageFormData {
        this.raw.title(titleText);
        return this;
    }
}

export class ModalFormData extends Wrapper<UI.ModalFormData> {
    public constructor() {
        super(new UI.ModalFormData());
    }

    dropdown(label: MC.RawMessage | string,
             options: (MC.RawMessage | string)[],
             defaultValueIndex?: number
            ): ModalFormData {
        this.raw.dropdown(label, options, defaultValueIndex);
        return this;
    }

    show(player: Player): Promise<UI.ModalFormResponse> {
        return this.raw.show(player.rawPlayer);
    }

    slider(label: MC.RawMessage | string,
           minimumValue: number,
           maximumValue: number,
           valueStep: number,
           defaultValue?: number,
          ): ModalFormData {
        this.raw.slider(label, minimumValue, maximumValue, valueStep, defaultValue);
        return this;
    }

    textField(label: MC.RawMessage | string,
              placeholderText: MC.RawMessage | string,
              defaultValue?: string
             ): ModalFormData {
        this.raw.textField(label, placeholderText, defaultValue);
        return this;
    }

    title(titleText: MC.RawMessage | string): ModalFormData {
        this.raw.title(titleText);
        return this;
    }

    toggle(label: MC.RawMessage | string, defaultValue?: boolean): ModalFormData {
        this.raw.toggle(label, defaultValue);
        return this;
    }
}
