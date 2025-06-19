import { OrdMap } from "../collections/ordered-map.js";
import { Player, PlayerPermissionLevel } from "../player.js";
import * as PP from "../pprint.js";

/* NOTE: Classes compiled using these decorators have to be targetted to
 * ES2020 atm, because the version of QuickJS used by MCBE 1.20.51 does not
 * support class static blocks.
 */

/* This is an implementation of pre-native custom commands. It is
 * deprecated as of cicada-lib 9.0.0 (MCBE 1.21.80) and will be probably
 * removed in the future.
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

/** FIXME: documentation */
export interface ICommand {
    run(runner: Player): void;
}

/** FIXME: documentation */
export interface CommandDefinitionOptions {
    aliases?: string[],
    opOnly?: boolean
}

const subcommandDefinition = Symbol("subcommandDefinition");
const commandParser        = Symbol("commandParser");

interface CommandDefinition<Class extends ICommand> {
    name: string;
    opts: CommandDefinitionOptions;
    ctor: new () => Class;
}

// Embedded in user-supplied classes by @subcommand class decorator.
interface SubcommandDefinition<Class> {
    name: string;
    opts: CommandDefinitionOptions;
    ctor: new () => Class;
}

type Setter<Class, Field> = (object: Class, value: Field) => void;
type ArgumentParser<Field> =
    PositionalArgumentParser<Field> /* | ... */;
type PositionalArgumentParser<Field> =
    SubcommandParser<Field> /* | ... */;

// FieldPopulator is an existential type and this is how we encode it in
// TypeScript.
interface FieldPopulator<Class> {
    readonly name: string;
    populate(run: <Field>(setter: Setter<Class, Field>,
                          parser: ArgumentParser<Field>) => void): void;
}
function mkFieldPopulator<Class, Field>(name: string,
                                        setter: Setter<Class, Field>,
                                        parser: ArgumentParser<Field>): FieldPopulator<Class> {
    return {
        name,
        populate: (run) => run(setter, parser)
    };
}

// Embedded in user-supplied classes by field decorators such as @flag,
// @positional, and @subcommand.
class CommandParser<Class> {
    readonly #posArgs: FieldPopulator<Class>[];

    public constructor() {
        this.#posArgs = [];
    }

    public subcommand<Field>(name: string,
                             setter: Setter<Class, Field>,
                             ctors: (new (args: string[]) => Field)[]): void {
        // FIXME: Verify that there are no subcommands prior to positional
        // arguments, or throw an error.
        this.#posArgs.push(
            mkFieldPopulator(name, setter, new SubcommandParser(ctors)));
    }

    public parse(runner: Player, args: string[], ctor: new () => Class): Class {
        const into = new ctor();

        let posArgIdx = 0;
        for (let i = 0; i < args.length; i++) {
            // FIXME: handle flags

            // It looks like a positional argument but is it really
            // so?
            const posArg = this.#posArgs[posArgIdx];
            if (!posArg)
                throw new CommandParsingError(`Unparsable argument: ${args[i]!}`);

            posArg.populate((setter, parser) => {
                if (parser instanceof SubcommandParser) {
                    // Encountering a subcommand causes a total state
                    // transition. The subcommand is expected to absorb
                    // all the remaining arguments.
                    setter(into, parser.parse(runner, args[i]!, args.slice(i+1)));
                    i = args.length; // So that we will exit the loop after
                                     // returning from this function.
                }
                else {
                    throw new Error(
                        `Internal error: unknown positional argument type: ${parser}`);
                }
            });
            posArgIdx++;
        }

        // FIXME: handle optional positional arguments
        if (posArgIdx < this.#posArgs.length)
            throw new CommandParsingError(
                `Argument <${this.#posArgs[posArgIdx]!.name}> is required but is missing`);

        return into;
    }
}

class SubcommandParser<Field> {
    readonly #subcmds: Map<string, SubcommandDefinition<Field>>;
    readonly #aliases: Map<string, string>;
    readonly #merged: OrdMap<string, SubcommandDefinition<Field>>;

    public constructor(ctors: (new (args: string[]) => Field)[]) {
        this.#subcmds = new Map();
        this.#aliases = new Map();
        this.#merged  = new OrdMap();

        for (const ctor of ctors) {
            const subcmd =
                ctor[Symbol.metadata]?.[subcommandDefinition] as SubcommandDefinition<Field>|undefined;

            if (!subcmd)
                throw new TypeError("Subcommand classes must also be decorated with @subcommand()");

            if (this.#merged.has(subcmd.name))
                throw new Error(`Duplicate subcommand: ${subcmd.name}`);

            for (const alias of subcmd.opts.aliases ?? []) {
                if (this.#merged.has(alias))
                    throw new Error(`Duplicate subcommand alias: ${alias}`);
            }

            this.#subcmds.set(subcmd.name, subcmd);
            this.#merged.set(subcmd.name, subcmd);
            for (const alias of subcmd.opts.aliases ?? []) {
                this.#aliases.set(alias, subcmd.name);
                this.#merged.set(alias, subcmd);
            }
        }
    }

    public parse(runner: Player, cmd: string, args: string[]): Field {
        // Find a definition of a subcommand using cmd as a prefix. We can
        // accept any prefixes of defined subcommands (such as "config" for
        // "configuration") because they're scoped in our own command.
        const closest = this.#merged.getGreaterThanEqual(cmd);
        if (!closest || !closest[0].startsWith(cmd))
            throw new CommandParsingError(
                `No subcommands starting with \`${cmd}' are available`);

        // But if it's also a prefix of the second-closest subcommand, the
        // supplied name is ambiguous.
        for (let nextKey = closest[0];; ) {
            const next = this.#merged.getGreaterThan(nextKey);
            if (next && next[0].startsWith(cmd)) {
                if (next[1].name === closest[1].name) {
                    // It's ambigious between aliases to the same
                    // command. We have no reason to reject it.
                    nextKey = next[0];
                    continue;
                }
                throw new CommandParsingError(
                    `\`${cmd}' is ambiguous because more than a single subcommand start with it`);
            }
            break;
        }

        if (closest[1].opts.opOnly && runner.permissionLevel != PlayerPermissionLevel.Operator)
            throw new CommandPermissionError(
                `The subcommand \`${closest[1].name}' is only for server operators`);

        const cmdParser =
            closest[1].ctor[Symbol.metadata]?.[commandParser] as CommandParser<Field>|undefined;
        if (!cmdParser)
            // This should have been populated by @subcommand.
            throw new Error(
                `Internal error: the class ${closest[1].ctor} does not have a command parser attached`);

        return cmdParser.parse(runner, args, closest[1].ctor);
    }
}

/** FIXME: documentation */
export function command<Class extends ICommand>(name: string, opts?: CommandDefinitionOptions):
    (target: new () => Class, context: ClassDecoratorContext<new () => Class>) =>
        void|(new () => Class) {

    return (target: new () => Class, context: ClassDecoratorContext<new () => Class>) => {
        // This can legitimately happen when Class has no decorated fields.
        (context.metadata[commandParser] as CommandParser<Class>|undefined)
            ??= new CommandParser();

        CommandRegistry.register({
            name,
            opts: opts ?? {},
            ctor: target
        });
    };
}

/** FIXME: documentation */
export function subcommand<Class extends {}>(name: string, opts?: CommandDefinitionOptions):
    (target: new () => Class, context: ClassDecoratorContext<new () => Class>) =>
        void|(new () => Class);

/** FIXME: documentation */
export function subcommand<Class extends {}, Field>(classes: (new () => any)[]):
    (target: undefined, context: ClassFieldDecoratorContext<Class, Field>) =>
        void|(() => Field);

export function subcommand<Class extends {}, Field>(...args: any[]) {
    if (typeof args[0] === "string") {
        // Used as a class decorator.
        return (target: new () => Class, context: ClassDecoratorContext<new () => Class>) => {
            // This can legitimately happen when Class has no decorated fields.
            (context.metadata[commandParser] as CommandParser<Class>|undefined)
                ??= new CommandParser();

            const subcmd: SubcommandDefinition<Class> = {
                name: args[0],
                opts: args[1] ?? {},
                ctor: target
            };
            context.metadata[subcommandDefinition] = subcmd;
        };
    }
    else {
        // Used as a field decorator.
        return (_target: undefined, context: ClassFieldDecoratorContext<Class, Field>) => {
            if (context.static)
                throw new TypeError(
                    `A field decorated with @subcommand must not be static: ${String(context.name)}`);

            const cmdParser =
                (context.metadata[commandParser] as CommandParser<Class>|undefined) ??= new CommandParser();

            const name = String(context.name); // FIXME: Custom argument names
            cmdParser.subcommand(name, context.access.set, args[0]);
        };
    }
}

/** Package private: user code should not use this */
export class CommandRegistry {
    static readonly #commands: Map<string, CommandDefinition<any>> = new Map();
    static readonly #aliases: Map<string, string> = new Map();
    static readonly #merged: Map<string, CommandDefinition<any>> = new Map();

    public static get empty(): boolean {
        return !this.#merged.size;
    }

    public static register<T extends ICommand>(cmd: CommandDefinition<T>): void {
        if (this.#merged.has(cmd.name))
            throw new Error(`Duplicate command: ${cmd.name}`);

        for (const alias of cmd.opts.aliases ?? []) {
            if (this.#merged.has(alias))
                throw new Error(`Duplicate command alias: ${alias}`);
        }

        this.#commands.set(cmd.name, cmd);
        this.#merged.set(cmd.name, cmd);
        for (const alias of cmd.opts.aliases ?? []) {
            this.#aliases.set(alias, cmd.name);
            this.#merged.set(alias, cmd);
        }
    }

    public static "get"<R>(runner: Player, name: string, args: string[],
                           whenFound: <T extends ICommand>(cmd: T) => R,
                           whenNotFound: () => R): R {
        const cmd = this.#merged.get(name);
        if (!cmd)
            return whenNotFound();

        if (cmd.opts.opOnly && runner.permissionLevel != PlayerPermissionLevel.Operator)
            throw new CommandPermissionError(
                `The command \`${cmd.name}' is only for server operators`);

        const cmdParser =
            cmd.ctor[Symbol.metadata]?.[commandParser] as CommandParser<any>|undefined;
        if (!cmdParser)
            // This should have been populated by @command.
            throw new Error(
                `Internal error: the class ${cmd.ctor} does not have a command parser attached`);

        return whenFound(cmdParser.parse(runner, args, cmd.ctor));
    }
}

/** Package private: user code should not use this. */
const ANY_SPECIALS    = /[\s\\'"]/;
const STRONG_SPECIALS = /[\\"]/;
export function prettyPrintCommandLine(tokens: string[]): PP.Doc {
    return PP.fillSep(tokens.map((token, idx) => {
        if (ANY_SPECIALS.test(token)) {
            // This token contains some special characters. Quote it to not
            // confuse players seeing it.
            const docs = [PP.darkGreen(PP.text('"'))];
            let   pos  = 0;
            while (pos < token.length) {
                const strong = token.slice(pos).search(STRONG_SPECIALS);
                if (strong >= 0) {
                    // Found a strong special character. Escape it.
                    if (pos < strong)
                        docs.push(PP.orange(PP.string(token.slice(pos, strong))));
                    docs.push(PP.lightBlue(PP.text("\\" + token[strong])));
                    pos = strong + 1;
                }
                else {
                    break;
                }
            }
            if (pos < token.length)
                docs.push(PP.orange(PP.string(token.slice(pos))));
            docs.push(PP.darkGreen(PP.text('"')));
            return PP.hcat(docs);
        }
        else if (idx == 0) {
            return PP.green(PP.string(token));
        }
        else {
            return PP.coolLightGray(PP.string(token));
        }
    }));
}

/** Package private: user code should not use this. */
export function tokeniseCommandLine(line: string, pos = 0): string[] {
    // An array of complete tokens. An element may be an empty string.
    const tokens: string[] = [];

    // An array of parts of the last token. No elements are empty strings.
    const lastToken: string[] = [];
    let lastLiteral = -1;
    let dQuote = -1;

    while (true) {
        if (pos >= line.length) {
            // This is the end of the line.
            if (dQuote >= 0)
                throw new CommandTokenisationError(
                    `Unterminated quoted string at position ${dQuote}`);
            if (lastLiteral >= 0 && lastLiteral < pos)
                lastToken.push(line.substring(lastLiteral, pos));
            if (lastToken.length > 0)
                tokens.push(lastToken.join(""));
            break;
        }

        switch (line[pos]!) {
            case ' ':
                if (dQuote < 0) {
                    // This is the end of the last token.
                    if (lastLiteral >= 0 && lastLiteral < pos) {
                        lastToken.push(line.substring(lastLiteral, pos));
                        lastLiteral = -1;
                    }
                    if (lastToken.length > 0) {
                        tokens.push(lastToken.join(""));
                        lastToken.splice(0);
                    }
                }
                pos++;
                break;

            case "'":
                if (dQuote < 0) {
                    // This is a beginning of a single-quoted string.
                    if (lastLiteral >= 0 && lastLiteral < pos) {
                        lastToken.push(line.substring(lastLiteral, pos));
                        lastLiteral = -1;
                    }

                    const quoteEnd = line.indexOf("'", pos + 1);
                    if (quoteEnd < 0) {
                        throw new CommandTokenisationError(
                            `Unterminated quoted string at position ${pos}`);
                    }
                    else if (quoteEnd > pos + 1) {
                        // This is a non-empty single-quoted string.
                        lastToken.push(line.substring(pos + 1, quoteEnd));
                    }
                    pos = quoteEnd + 1;
                }
                else {
                    pos++;
                }
                break;

            case '"':
                if (lastLiteral >= 0 && lastLiteral < pos) {
                    lastToken.push(line.substring(lastLiteral, pos));
                    lastLiteral = -1;
                }

                if (dQuote < 0)
                    // This is the beginning of a double-quoted string.
                    dQuote = pos;
                else
                    // This is the end of a double-quoted string.
                    dQuote = -1;

                pos++;
                break;

            case '\\':
                if (lastLiteral >= 0 && lastLiteral < pos) {
                    lastToken.push(line.substring(lastLiteral, pos));
                    lastLiteral = -1;
                }

                if (pos + 1 >= line.length)
                    throw new CommandTokenisationError(
                        `Incomplete escape sequence at position ${pos}`);

                lastLiteral = pos + 1;
                pos += 2;
                break;

            default:
                if (lastLiteral < 0)
                    lastLiteral = pos;
                pos++;
        }
    }
    return tokens;
}

/// @internal
export class CommandTokenisationError extends Error {}

/// @internal
export class CommandParsingError extends Error {}

/// @internal
export class CommandPermissionError extends Error {}
