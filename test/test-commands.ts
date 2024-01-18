import "mocha";
import { expect } from "chai";
import { Player } from "../lib/player.js";
import { CommandRegistry, CommandTokenisationError, CommandParsingError,
         command, subcommand, tokeniseCommandLine } from "../lib/command.js";

@subcommand("aabc")
class SubcommandAabcOfCommandFoo {}

@subcommand("aacd")
class SubcommandAacdOfCommandFoo {}

@command("foo", {aliases: ["f-o-o"]})
// @ts-ignore: TypeScript thinks it's unused while it's not.
class CommandFoo {
    @subcommand([SubcommandAabcOfCommandFoo, SubcommandAacdOfCommandFoo])
    public readonly subcommand!: SubcommandAabcOfCommandFoo|SubcommandAacdOfCommandFoo;

    public run(_runner: Player): void {
        if (this.subcommand instanceof SubcommandAabcOfCommandFoo) {
            // ...
        }
        else if (this.subcommand instanceof SubcommandAacdOfCommandFoo) {
            // ...
        }
        else {
            throw new TypeError(`run(): ${this.subcommand} has a wrong type`);
        }
    }
}

function runCommand(line: string) {
    const tokens = tokeniseCommandLine(line);
    if (tokens.length >= 1) {
        CommandRegistry.get(
            tokens[0]!, tokens.slice(1),
            cmd => { cmd.run(undefined as any as Player) },
            ()  => { throw new Error(`Command not found: ${tokens[0]!}`) });
    }
    else {
        throw new Error(`Empty command line`);
    }
}

describe("tokeniseCommandLine", () => {
    it("can parse basic argument lists", () => {
        expect(tokeniseCommandLine("foo")).to.deep.equal(["foo"]);
        expect(tokeniseCommandLine("foo bar")).to.deep.equal(["foo", "bar"]);
        expect(tokeniseCommandLine(";foo bar", 1)).to.deep.equal(["foo", "bar"]);
    });
    it("skips non-quoted white spaces", () => {
        expect(tokeniseCommandLine(" foo  bar   ")).to.deep.equal(["foo", "bar"]);
    });
    it("recognises single-quoted strings", () => {
        expect(tokeniseCommandLine("foo bar'baz'")).to.deep.equal(["foo", "barbaz"]);
    });
    it("recognises double-quoted strings", () => {
        expect(tokeniseCommandLine("foo bar\"baz\"")).to.deep.equal(["foo", "barbaz"]);
    });
    it("doesn't skip white spaces in single-quoted strings", () => {
        expect(tokeniseCommandLine("foo 'bar  baz'")).to.deep.equal(["foo", "bar  baz"]);
    });
    it("doesn't skip white spaces in double-quoted strings", () => {
        expect(tokeniseCommandLine("foo \"bar  baz\"")).to.deep.equal(["foo", "bar  baz"]);
    });
    it("treats single quotes in double-quoted strings literally", () => {
        expect(tokeniseCommandLine("foo \"bar'baz\"")).to.deep.equal(["foo", "bar'baz"]);
    });
    it("recognises escaped special characters", () => {
        expect(tokeniseCommandLine("foo\\  bar\\'")).to.deep.equal(["foo ", "bar'"]);
    });
    it("throws an error for unterminated single-quoted strings", () => {
        expect(() => tokeniseCommandLine("'foo")).to.throw(CommandTokenisationError);
    });
    it("throws an error for unterminated double-quoted strings", () => {
        expect(() => tokeniseCommandLine("\"foo")).to.throw(CommandTokenisationError);
    });
    it("throws an error for incomplete escape sequences", () => {
        expect(() => tokeniseCommandLine("foo\\")).to.throw(CommandTokenisationError);
    });
});

describe("@command", () => {
    it("registers a command to the registry", () => {
        expect(() => runCommand("foo aabc")).to.not.throw();
    });
    it("can resolve aliases", () => {
        expect(() => runCommand("f-o-o aabc")).to.not.throw();
    });
});

describe("@subcommand", () => {
    it("can find a subcommand with a prefix as long as it's not ambiguous", () => {
        expect(() => runCommand("foo aab")).to.not.throw();
        expect(() => runCommand("foo aac")).to.not.throw();
        expect(() => runCommand("foo aa" )).to.throw(CommandParsingError);
    });
    it("throws an error if no subcommands are given", () => {
        expect(() => runCommand("foo")).to.throw(CommandParsingError);
    });
});
