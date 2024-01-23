import "mocha";
import { expect } from "chai";
import { Player } from "../lib/player.js";
import { CommandRegistry, CommandTokenisationError, CommandParsingError,
         CommandPermissionError, command, subcommand, tokeniseCommandLine
       } from "../lib/command.js";

@subcommand("aabc", {aliases: ["aabc-xxxx", "AABC"]})
class SubcommandAabc {}

@subcommand("aacd")
class SubcommandAacd {}

@subcommand("op", {opOnly: true})
class SubcommandOp {}

@command("foo", {aliases: ["f-o-o"]})
// @ts-ignore: TypeScript thinks it's unused while it's not.
class CommandFoo {
    @subcommand([SubcommandAabc, SubcommandAacd, SubcommandOp])
    public readonly subcommand!: SubcommandAabc|SubcommandAacd|SubcommandOp;

    public run(_runner: Player): void {
        if (this.subcommand instanceof SubcommandAabc) {
            // ...
        }
        else if (this.subcommand instanceof SubcommandAacd) {
            // ...
        }
        else if (this.subcommand instanceof SubcommandOp) {
            // ...
        }
        else {
            throw new TypeError(`run(): ${this.subcommand} has a wrong type`);
        }
    }
}

@command("op", {opOnly: true})
// @ts-ignore: TypeScript thinks it's unused while it's not.
class CommandOp {
    public run(_runner: Player): void {}
}

function runCommand(line: string, asOp = false) {
    const tokens = tokeniseCommandLine(line);
    if (tokens.length >= 1) {
        const runner: Player = {isOp: asOp} as any;
        CommandRegistry.get(
            runner, tokens[0]!, tokens.slice(1),
            cmd => { cmd.run(runner) },
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
    it("only allows server ops to run op-only commands", () => {
        expect(() => runCommand("op")).to.throw(CommandPermissionError);
        expect(() => runCommand("op", true)).to.not.throw();
    });
});

describe("@subcommand", () => {
    it("can find a subcommand with a prefix as long as it's not ambiguous", () => {
        expect(() => runCommand("foo aab")).to.not.throw();
        expect(() => runCommand("foo aac")).to.not.throw();
        expect(() => runCommand("foo aa" )).to.throw(CommandParsingError);
    });
    it("can resolve aliases", () => {
        expect(() => runCommand("f-o-o AABC")).to.not.throw();
    });
    it("only allows server ops to run op-only commands", () => {
        expect(() => runCommand("foo op")).to.throw(CommandPermissionError);
        expect(() => runCommand("foo op", true)).to.not.throw();
    });
    it("throws an error if no subcommands are given", () => {
        expect(() => runCommand("foo")).to.throw(CommandParsingError);
    });
});
