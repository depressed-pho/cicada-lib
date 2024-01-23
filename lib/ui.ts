import { delay } from "./delay.js";
import { Player } from "./player.js";
import { Wrapper } from "./wrapper.js";
import { RawMessage } from "@minecraft/server";
import { FormCancelationReason } from "@minecraft/server-ui";
import * as UI from "@minecraft/server-ui";

export {
    FormCancelationReason
};

export interface FormOptions {
    /** Redisplay the form when it cannot be shown because the user is
     * interacting with some other UIs. If it's a number it's interpreted
     * as the maximum number of retries. Setting it to `true` is the same
     * as `Infinity`, and setting it to `false` is the same as
     * `0`. Defaults to `false`.
     */
    retryWhenBusy?: boolean|number;

    /** Delay between busy retries in seconds. Defaults to `0.2`.
     */
    retryDelayWhenBusy?: number;

    /** Redisplay the form when the user cancels it. The value is
     * interpreted in the same way as `retryWhenBusy`. Unlike busy retries,
     * this has no delays.
     */
    retryOnCancel?: boolean|number;
}

export class FormResponse extends Wrapper<UI.FormResponse> {
    readonly cancelationReason?: FormCancelationReason;
    readonly canceled: boolean;

    /// @internal
    public constructor(raw: UI.FormResponse) {
        super(raw);
        if (raw.cancelationReason)
            this.cancelationReason = raw.cancelationReason;
        this.canceled = raw.canceled;
    }
}

export class ActionFormResponse extends FormResponse {
    readonly selection?: any;

    /// @internal
    public constructor(raw: UI.ActionFormResponse, keys: any[]) {
        super(raw);
        if (raw.selection !== undefined)
            this.selection = keys[raw.selection]!;
    }
}

export class MessageFormResponse extends FormResponse {
    readonly selection?: any;

    /// @internal
    public constructor(raw: UI.MessageFormResponse, keys: [any, any]) {
        super(raw);
        if (raw.selection !== undefined)
            this.selection = keys[raw.selection]!;
    }
}

export class ModalFormResponse extends FormResponse {
    readonly formValues?: ModalFormValues;

    /// @internal
    public constructor(raw: UI.ModalFormResponse,
                       interpret: (formValues: (boolean|number|string)[]) => ModalFormValues) {
        super(raw);
        if (raw.formValues) {
            this.formValues = interpret(raw.formValues);
        }
    }
}

export class ModalFormValues extends Map<any, any> {
    public getBoolean(key: any): boolean {
        const val = this.get(key);
        switch (typeof val) {
            case "boolean":
                return val;
            case undefined:
                throw new Error(`No form values exist for key ${String(key)}`);
            default:
                throw new Error(`The form value for key ${String(key)} is not a boolean: ${String(val)}`);
        }
    }

    public getNumber(key: any): number {
        const val = this.get(key);
        switch (typeof val) {
            case "number":
                return val;
            case undefined:
                throw new Error(`No form values exist for key ${String(key)}`);
            default:
                throw new Error(`The form value for key ${String(key)} is not a number: ${String(val)}`);
        }
    }

    public getString(key: any): number {
        const val = this.get(key);
        switch (typeof val) {
            case "string":
                return val;
            case undefined:
                throw new Error(`No form values exist for key ${String(key)}`);
            default:
                throw new Error(`The form value for key ${String(key)} is not a string: ${String(val)}`);
        }
    }
}

function unifyToNumber(val: boolean|number): number {
    return typeof val === "number"
        ? val
        : (val ? Infinity : 0);
}

async function genericShow<R extends UI.FormResponse>(thunk: () => Promise<R>,
                                                      opts?: FormOptions): Promise<R> {
    let busyRetries   = 0;
    let cancelRetries = 0;
    while (true) {
        const res = await thunk();
        switch (res.cancelationReason) {
            case undefined: // Submitted
                return res;

            case UI.FormCancelationReason.UserBusy:
                if (busyRetries < unifyToNumber(opts?.retryWhenBusy ?? false)) {
                    busyRetries++;
                    await delay(opts?.retryDelayWhenBusy ?? 0.2);
                    continue;
                }
                return res;

            case UI.FormCancelationReason.UserClosed:
                if (cancelRetries < unifyToNumber(opts?.retryOnCancel ?? false)) {
                    cancelRetries++;
                    continue;
                }
                return res;
        }
    }
}

export class ActionFormData extends Wrapper<UI.ActionFormData> {
    readonly #buttonKeys: any[];

    public constructor() {
        super(new UI.ActionFormData());
        this.#buttonKeys = [];
    }

    /** Sets the body text for the modal form. */
    body(bodyText: RawMessage|string): ActionFormData {
        this.raw.body(bodyText);
        return this;
    }

    /** Add a button to this form with an icon from a resource pack. The
     * value `key` will show up in {@link
     * ActionFormResponse.prototype.selection} if the form is closed by
     * clicking this button.
     */
    button(key: any, text: RawMessage|string, iconPath?: string): ActionFormData {
        this.#buttonKeys.push(key);
        this.raw.button(text, iconPath);
        return this;
    }

    /** Create and show this modal popup form. Return asynchronously when
     * the player confirms or cancels the dialog.
     */
    async show(player: Player, opts?: FormOptions): Promise<ActionFormResponse> {
        const raw = await genericShow(() => this.raw.show(player.rawPlayer), opts);
        return new ActionFormResponse(raw, this.#buttonKeys);
    }

    /** Set the title for the modal dialog. */
    title(titleText: RawMessage|string): ActionFormData {
        this.raw.title(titleText);
        return this;
    }
}

export class MessageFormData extends Wrapper<UI.MessageFormData> {
    readonly #buttonKeys: [any, any];

    public constructor() {
        super(new UI.MessageFormData());
        this.#buttonKeys = [undefined, undefined];
    }

    /** Set the body text for the modal form. */
    body(bodyText: RawMessage|string): MessageFormData {
        this.raw.body(bodyText);
        return this;
    }

    /** Set the text for the first button of the dialog. The value `key`
     * will show up in {@link MessageFormResponse.prototype.selection} if
     * the form is closed by clicking this button.
     */
    button1(key: any, text: RawMessage|string): MessageFormData {
        this.#buttonKeys[0] = key;
        this.raw.button1(text);
        return this;
    }

    /** Set the text for the second button of the dialog. The value `key`
     * will show up in {@link MessageFormResponse.prototype.selection} if
     * the form is closed by clicking this button.
     */
    button2(key: any, text: RawMessage|string): MessageFormData {
        this.#buttonKeys[1] = key;
        this.raw.button2(text);
        return this;
    }

    /** Create and show this modal popup form. Return asynchronously when
     * the player confirms or cancels the dialog.
     */
    async show(player: Player, opts?: FormOptions): Promise<UI.MessageFormResponse> {
        const raw = await genericShow(() => this.raw.show(player.rawPlayer), opts);
        return new MessageFormResponse(raw, this.#buttonKeys);
    }

    /** Set the title for the modal dialog. */
    title(titleText: RawMessage|string): MessageFormData {
        this.raw.title(titleText);
        return this;
    }
}

export class ModalFormData extends Wrapper<UI.ModalFormData> {
    readonly #items: ((formValue: boolean|number|string) => [any, any])[];

    public constructor() {
        super(new UI.ModalFormData());
        this.#items = [];
    }

    /** Add a dropdown with choices to the form. `options` is an iterable
     * object (such as `Array`) of tuples `[optionKey, optionLabel]`. The
     * value `key` will show up as a key of {@link ModalFormResponse.prototype.formValues} with a
     * corresponding option key.
     */
    dropdown(key: any,
             label: RawMessage|string,
             options: Iterable<[any, RawMessage|string]>,
             defaultValueIndex?: number
            ): ModalFormData {

        const optKeys: any[] = [];
        const optLabels = [];
        for (const [optKey, optLabel] of options) {
            optKeys.push(optKey);
            optLabels.push(optLabel);
        }

        this.#items.push(formValue => {
            if (typeof formValue !== "number")
                throw new Error(
                    `Internal error: wrong type of form value ${String(formValue)} for key ${String(key)}`);
            return [key, optKeys[formValue]!];
        });
        this.raw.dropdown(label, optLabels, defaultValueIndex);
        return this;
    }

    /** Create and show this modal popup form. Return asynchronously
     * when the player confirms or cancels the dialog.
     */
    async show(player: Player, opts?: FormOptions): Promise<ModalFormResponse> {
        const raw = await genericShow(() => this.raw.show(player.rawPlayer), opts);
        return new ModalFormResponse(raw, formValues => {
            const map = new ModalFormValues();
            for (let i = 0; i < this.#items.length; i++) {
                const [key, val] = this.#items[i]!(formValues[i]!);
                map.set(key, val);
            }
            return map;
        });
    }

    /** Add a numeric slider to the form. The value `key` will show up as a
     * key of {@link ModalFormResponse.prototype.formValues} with a
     * corresponding numeric value.
     */
    slider(key: any,
           label: RawMessage|string,
           minimumValue: number,
           maximumValue: number,
           valueStep: number,
           defaultValue?: number,
          ): ModalFormData {
        this.#items.push(formValue => [key, formValue]);
        this.raw.slider(label, minimumValue, maximumValue, valueStep, defaultValue);
        return this;
    }

    /** Add a textbox to the form. The value `key` will show up as a key of
     * {@link ModalFormResponse.prototype.formValues} with a corresponding
     * string value.
     */
    textField(key: any,
              label: RawMessage|string,
              placeholderText: RawMessage|string,
              defaultValue?: string
             ): ModalFormData {
        this.#items.push(formValue => [key, formValue]);
        this.raw.textField(label, placeholderText, defaultValue);
        return this;
    }

    /** Set the title for the modal dialog. */
    title(titleText: RawMessage|string): ModalFormData {
        this.raw.title(titleText);
        return this;
    }

    /** Add a toggle checkbox button to the form. The value `key` will show
     * up as a key of {@link ModalFormResponse.prototype.formValues} with a
     * corresponding boolean value. */
    toggle(key: any, label: RawMessage|string, defaultValue?: boolean): ModalFormData {
        this.#items.push(formValue => [key, formValue]);
        this.raw.toggle(label, defaultValue);
        return this;
    }
}
