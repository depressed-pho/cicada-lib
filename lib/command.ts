import { OrdMap } from "./collections/ordered-map.js";
import { Player } from "./player.js";

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
    aliases?: string[]
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
    ctor: new () => Class;
}

type Setter<Class, Field> = (object: Class, value: Field) => void;
type ArgumentParser<Field> =
    PositionalArgumentParser<Field> /* | ... */;
type PositionalArgumentParser<Field> =
    SubcommandParser<Field> /* | ... */;

// FieldPopulator is an existential type and this is how we encode it in
// TypeScript.
type FieldPopulator<Class> = (run: <Field>(setter: Setter<Class, Field>,
                                           parser: ArgumentParser<Field>) => void) => void;
function mkFieldPopulator<Class, Field>(setter: Setter<Class, Field>,
                                        parser: ArgumentParser<Field>): FieldPopulator<Class> {
    return (run) => run(setter, parser);
}

// Embedded in user-supplied classes by field decorators such as @flag,
// @positional, and @subcommand.
class CommandParser<Class> {
    readonly #posArgs: FieldPopulator<Class>[];

    public constructor() {
        this.#posArgs = [];
    }

    public subcommand<Field>(setter: Setter<Class, Field>,
                             ctors: (new (args: string[]) => Field)[]): void {
        // FIXME: Verify that there are no subcommands prior to positional
        // arguments, or throw an error.
        this.#posArgs.push(
            mkFieldPopulator(setter, new SubcommandParser(ctors)));
    }

    public parse(args: string[], ctor: new () => Class): Class {
        const into = new ctor();

        let posArgIdx = 0;
        for (let i = 0; i < args.length; i++) {
            // FIXME: handle flags

            // It looks like a positional argument but is it really
            // so?
            const posArg = this.#posArgs[posArgIdx];
            if (!posArg) {
                throw new CommandParsingError(
                    `Positional argument #{pos} not defined`);
            }
            posArg((setter, parser) => {
                if (parser instanceof SubcommandParser) {
                    // Encountering a subcommand causes a total state
                    // transition. The subcommand is expected to absorb
                    // all the remaining arguments.
                    setter(into, parser.parse(args[i]!, args.slice(i+1)));
                    i = args.length; // So that we will exit the loop after
                                     // returning from this function.
                }
                else {
                    throw new Error(
                        `Internal error: unknown positional argument type: ${parser}`);
                }
            });
        }

        return into;
    }
}

class SubcommandParser<Field> {
    readonly #subcmds: OrdMap<string, SubcommandDefinition<Field>>;

    public constructor(ctors: (new (args: string[]) => Field)[]) {
        this.#subcmds = new OrdMap();
        for (const ctor of ctors) {
            const subcmd =
                ctor[Symbol.metadata]?.[subcommandDefinition] as SubcommandDefinition<Field>|undefined;

            if (!subcmd)
                throw new Error("Subcommand classes must also be decorated with @subcommand()");

            if (this.#subcmds.has(subcmd.name))
                throw new Error(`Duplicate subcommand: ${subcmd.name}`);
            else
                this.#subcmds.set(subcmd.name, subcmd);
        }
    }

    public parse(cmd: string, args: string[]): Field {
        // Find a definition of a subcommand using cmd as a prefix. We can
        // accept any prefixes of defined subcommands (such as "config" for
        // "configuration") because they're scoped in our own command.
        const closest = this.#subcmds.getGreaterThanEqual(cmd);
        if (!closest || !closest[0].startsWith(cmd))
            throw new CommandParsingError(
                `No subcommands starting with \`${cmd}' are available`);

        // But if it's also a prefix of the second-closest subcommand, the
        // supplied name is ambiguous.
        const next = this.#subcmds.getGreaterThan(closest[0]);
        if (next && next[0].startsWith(cmd))
            throw new CommandParsingError(
                `\`${cmd}' is ambiguous because more than a single subcommand start with it`);

        const cmdParser =
            closest[1].ctor[Symbol.metadata]?.[commandParser] as CommandParser<Field>|undefined;
        if (!cmdParser)
            // This should have been populated by @subcommand.
            throw new Error(
                `Internal error: the class ${closest[1].ctor} does not have a command parser attached`);

        return cmdParser.parse(args, closest[1].ctor);
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
export function subcommand<Class extends {}>(name: string):
    (target: new () => Class, context: ClassDecoratorContext<new () => Class>) =>
        void|(new () => Class);

/** FIXME: documentation */
export function subcommand<Class extends {}, Field>(classes: (new () => any)[]):
    (target: undefined, context: ClassFieldDecoratorContext<Class, Field>) =>
        void|(() => Field);

export function subcommand<Class extends {}, Field>(arg: any) {
    if (typeof arg === "string") {
        // Used as a class decorator.
        return (target: new () => Class, context: ClassDecoratorContext<new () => Class>) => {
            // This can legitimately happen when Class has no decorated fields.
            (context.metadata[commandParser] as CommandParser<Class>|undefined)
                ??= new CommandParser();

            const subcmd: SubcommandDefinition<Class> = {
                name: arg,
                ctor: target
            };
            context.metadata[subcommandDefinition] = subcmd;
        };
    }
    else {
        // Used as a field decorator.
        return (_target: undefined, context: ClassFieldDecoratorContext<Class, Field>) => {
            if (context.static)
                throw new Error(
                    `A field decorated with @subcommand must not be static: ${String(context.name)}`);

            const cmdParser =
                (context.metadata[commandParser] as CommandParser<Class>|undefined) ??= new CommandParser();

            cmdParser.subcommand(context.access.set, arg);
        };
    }
}

/** Package private: user code should not use this */
export class CommandRegistry {
    static readonly #commands: Map<string, CommandDefinition<any>> = new Map();
    static readonly #aliases: Map<string, string> = new Map();

    public static get empty(): boolean {
        return !this.#commands.size;
    }

    public static register<T extends ICommand>(cmd: CommandDefinition<T>): void {
        if (this.#commands.has(cmd.name))
            throw new Error(`Duplicate command: ${cmd.name}`);

        for (const alias of cmd.opts.aliases ?? []) {
            if (this.#aliases.has(alias))
                throw new Error(`Duplicate command alias: ${alias}`);
        }

        this.#commands.set(cmd.name, cmd);
        for (const alias of cmd.opts.aliases ?? []) {
            this.#aliases.set(alias, cmd.name);
        }
    }

    public static "get"<R>(name: string, args: string[],
                           whenFound: <T extends ICommand>(cmd: T) => R,
                           whenNotFound: () => R): R {
        const origName = this.#aliases.get(name);
        const cmd      = this.#commands.get(origName ?? name);
        if (!cmd)
            return whenNotFound();

        const cmdParser =
            cmd.ctor[Symbol.metadata]?.[commandParser] as CommandParser<any>|undefined;
        if (!cmdParser)
            // This should have been populated by @command.
            throw new Error(
                `Internal error: the class ${cmd.ctor} does not have a command parser attached`);

        return whenFound(cmdParser.parse(args, cmd.ctor));
    }
}

/** Package private: user code should not use this */
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

/** Package private: user code should not use this */
export class CommandTokenisationError extends Error {}

/** Package private: user code should not use this */
export class CommandParsingError extends Error {}
