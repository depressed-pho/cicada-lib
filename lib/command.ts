import { Block } from "./block.js";
import { Entity } from "./entity.js";
import { Player } from "./player.js";
import "./system.js"; // Someone needs to load it, otherwise commands won't
                      // be registered.
import * as MC from "@minecraft/server";

/* NOTE: Classes compiled using these decorators have to be targetted to
 * ES2020 atm, because the version of QuickJS used by MCBE 1.20.51 does not
 * support class static blocks.
 */

// We are going to use decorator metadata but it's unlikely that the
// runtime supports it natively. Here's a polyfill.
if (!("metadata" in Symbol)) {
    Object.defineProperty(Symbol, "metadata", {
        // @ts-ignore: TypeScript says Symbol isn't callable but I don't
        // understand why.
        value: Symbol("Symbol.metadata")
    });
}

/** Classes implementing this interface are custom commands. Those classes
 * should be decorated with `@command`, and their fields should be
 * decorated with `@parameter` if need be.
 */
export interface ICommand {
    run(origin: CommandOrigin): CommandResult;
}

/** The origin of the command. */
export type CommandOrigin = Block | Entity | Server;

/** This is used as a command origin if the command originated from the
 * server.
 */
export class Server {
    private constructor() {}
}

/** Result of a custom command. */
export interface CommandResult {
    /** Message displayed to chat after command execution.
     */
    message?: string;

    /** Command execution success or failure. Determines how the status
     * message is displayed.
     */
    status: "succeeded" | "failed";
}

export interface CommandDefinition {
    /** Cheats must be enabled to run this command. Defaults to false. */
    cheatsRequired?: boolean;

    /** Command description as seen on the command line. */
    description: string;

    /** The name of the command. A namespace is required. */
    name: string;

    /** The permission level required to execute the command. */
    permissionLevel: CommandPermissionLevel;
}

export type CommandPermissionLevel =
    /** Anything can run this command. */
    "any" |
    /** Any operator can run this command, including command blocks. */
    "game-directors" |
    /** Any operator can run this command, but NOT command blocks. */
    "admin" |
    /** Any server host can run this command. */
    "host" |
    /** Only dedicated server can run this command. */
    "owner";

export type ParameterType =
    "boolean" |
    "integer" |
    "float" |
    "string" |
    "entity-selector" |
    "player-selector" |
    "location" |
    "block-type" |
    "item-type" |
    "enum";

export interface ParameterDefinition {
    /** The name of parameter as it appears on the command line, defaulted
     * to the name of the field.
     */
    name?: string;

    /** The parameter is optional if true, otherwise it's mandatory. False
     * by default.
     */
    optional?: boolean;

    /** The data type of the parameter. */
    type: ParameterType;
}

type Setter<Class, Field> = (object: Class, value: Field) => void;

// FieldPopulator is an existential type and this is how we encode it in
// TypeScript.
interface FieldPopulator<Class> {
    readonly def: Required<ParameterDefinition>;
    populate(run: <Field>(setter: Setter<Class, Field>) => void): void;
}
function mkFieldPopulator<Class, Field>(def: Required<ParameterDefinition>,
                                        setter: Setter<Class, Field>): FieldPopulator<Class> {
    return {
        def,
        populate: run => run(setter)
    };
}

// Embedded in user-supplied classes by the @parameter field decorator.
const commandParams = Symbol("commandParams");
class CommandParams<Class> {
    readonly #mandatoryParams: FieldPopulator<Class>[];
    readonly #optionalParams: FieldPopulator<Class>[];

    static readonly #nativeTypeOf: Map<ParameterType, MC.CustomCommandParamType> =
        new Map(
            [ ["boolean"        , MC.CustomCommandParamType.Boolean       ],
              ["integer"        , MC.CustomCommandParamType.Integer       ],
              ["float"          , MC.CustomCommandParamType.Float         ],
              ["string"         , MC.CustomCommandParamType.String        ],
              ["entity-selector", MC.CustomCommandParamType.EntitySelector],
              ["player-selector", MC.CustomCommandParamType.PlayerSelector],
              ["location"       , MC.CustomCommandParamType.Location      ],
              ["block-type"     , MC.CustomCommandParamType.BlockType     ],
              ["item-type"      , MC.CustomCommandParamType.ItemType      ],
              ["enum"           , MC.CustomCommandParamType.Enum          ]
            ]);

    static #toNativeType(type: ParameterType): MC.CustomCommandParamType {
        const ret = this.#nativeTypeOf.get(type);
        if (ret === undefined)
            throw new Error(`Internal error: no native type is known for ${type}`);
        return ret;
    }

    static #toNativeParams(params: FieldPopulator<any>[]): MC.CustomCommandParameter[] {
        return params.map(param => {
            return {
                name: param.def.name,
                type: this.#toNativeType(param.def.type)
            };
        });
    }

    public constructor() {
        this.#mandatoryParams = [];
        this.#optionalParams = [];
    }

    public get mandatoryParams(): MC.CustomCommandParameter[] {
        return CommandParams.#toNativeParams(this.#mandatoryParams);
    }

    public get optionalParams(): MC.CustomCommandParameter[] {
        return CommandParams.#toNativeParams(this.#optionalParams);
    }

    public push<Field>(def: Required<ParameterDefinition>,
                       setter: Setter<Class, Field>) {
        if (def.optional) {
            this.#optionalParams.push(mkFieldPopulator(def, setter));
        }
        else {
            // The API documentation isn't clear as to what would happen in
            // this case, but we throw an error for now.
            if (this.#optionalParams.length > 0)
                throw new Error("A mandatory parameter cannot appear after optional ones");

            this.#mandatoryParams.push(mkFieldPopulator(def, setter));
        }
    }

    public instantiate(args: any[], ctor: new () => Class): Class {
        const obj = new ctor();

        for (let i = 0; i < args.length; i++) {
            const param = (() => {
                if (i < this.#mandatoryParams.length) {
                    return this.#mandatoryParams[i];
                }

                const j = i - this.#mandatoryParams.length;
                if (j < this.#optionalParams.length) {
                    return this.#optionalParams[j];
                }

                throw new Error(`Internal inconsistency: parameter ${i} is out of bounds`);
            })();

            // @ts-ignore: TypeScript thinks param can be undefined, but
            // that's simply impossible. Definitely a compiler bug.
            param.populate(setter => {
                setter(obj, args[i]);
            });
        }

        return obj;
    }
}

/** This is a class decorator that gives metadata to a custom command and
 * registers it.
 */
export function command<Class extends ICommand>(def: CommandDefinition):
    (target: new () => Class, context: ClassDecoratorContext<new () => Class>) =>
        void|(new () => Class) {

    return (target: new () => Class, context: ClassDecoratorContext<new () => Class>) => {
        // Its CommandParams is missing. This can legitimately happen when
        // Class has no decorated fields.
        (context.metadata[commandParams] as CommandParams<Class>|undefined)
            ??= new CommandParams();

        CommandRegistry.add(target, def);
    };
}

/// @internal
export class CommandRegistry {
    static readonly #commands: Map<string, CommandDefinition & {ctor: new () => any}> = new Map();

    static readonly #nativePermOf: Map<CommandPermissionLevel, MC.CommandPermissionLevel> =
        new Map(
            [ ["any"           , MC.CommandPermissionLevel.Any          ],
              ["game-directors", MC.CommandPermissionLevel.GameDirectors],
              ["admin"         , MC.CommandPermissionLevel.Admin        ],
              ["host"          , MC.CommandPermissionLevel.Host         ],
              ["owner"         , MC.CommandPermissionLevel.Owner        ],
            ]);

    static #toNativePermissionLevel(perm: CommandPermissionLevel): MC.CommandPermissionLevel {
        const ret = this.#nativePermOf.get(perm);
        if (ret === undefined)
            throw new Error(`Internal error: no native permission level is known for ${perm}`);
        return ret;
    }

    static #fromNativeOrigin(origin: MC.CustomCommandOrigin): CommandOrigin {
        switch (origin.sourceType) {
            case MC.CustomCommandSource.Block:
                return new Block(origin.sourceBlock!);

            case MC.CustomCommandSource.Entity:
                if (origin.sourceEntity!.typeId === "minecraft:player")
                    return new Player(origin.sourceEntity as MC.Player);
                else
                    return new Entity(origin.sourceEntity!);

            case MC.CustomCommandSource.NPCDialogue:
                // The API documentation is vague but in this case it's
                // likely that origin.initiator is the player who
                // interected with the NPC, and origin.sourceEntity is the
                // NPC itself. We don't know what to do, but addon authors
                // would probably want to know who initiated it.
                if (origin.initiator!.typeId === "minecraft:player")
                    return new Player(origin.initiator as MC.Player);
                else
                    return new Entity(origin.initiator!);

            case MC.CustomCommandSource.NPCDialogue:
                // @ts-ignore: Intentionally calling a private constructor.
                return new Server();

            default:
                throw new Error(`Unknown command source type: ${origin.sourceType}`);
        }
    }

    static #toNativeResult(result: CommandResult): MC.CustomCommandResult {
        const status = (() => {
            switch (result.status) {
                case "succeeded": return MC.CustomCommandStatus.Success;
                case "failed":    return MC.CustomCommandStatus.Failure;
                default:
                    throw new Error(`Unknown command status: ${result.status}`);
            }
        })();
        return {
            ...(result.message !== undefined ? {message: result.message} : {}),
            status
        };
    }

    public static add<T extends ICommand>(ctor: new () => T, def: CommandDefinition) {
        if (this.#commands.has(def.name))
            throw new Error(`Duplicate command: ${def.name}`);

        this.#commands.set(
            def.name,
            { ...(def), ctor });
    }

    public static register(reg: MC.CustomCommandRegistry) {
        // THINKME: What about enums? How are we going to register them?
        for (const cmd of this.#commands.values()) {

            const params =
                cmd.ctor[Symbol.metadata]?.[commandParams] as CommandParams<any>|undefined;
            if (!params) {
                // This should have been populated by @command.
                throw new Error(
                    `Internal error: the class ${cmd.ctor} does not have command parameters attached`);
            }

            const nativeCmd = {
                cheatsRequired: cmd.cheatsRequired ?? false,
                description: cmd.description,
                mandatoryParameters: params.mandatoryParams,
                name: cmd.name,
                optionalParameters: params.optionalParams,
                permissionLevel: CommandRegistry.#toNativePermissionLevel(cmd.permissionLevel)
            };
            reg.registerCommand(
                nativeCmd,
                (origin, ...args) => {
                    const obj = params.instantiate(args, cmd.ctor);
                    const res = obj.run(CommandRegistry.#fromNativeOrigin(origin));
                    return CommandRegistry.#toNativeResult(res);
                });
        }
    }
}
