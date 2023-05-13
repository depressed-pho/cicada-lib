import "mocha";
import { expect } from "chai";
import * as P from "../lib/parser.js";

describe("Parser", () => {
    describe("Individual characters", () => {
        describe("anyChar", () => {
            it("parses any character", () => {
                expect(
                    P.parse(P.anyChar, "🠖bcde")
                ).to.deep.equal({done: "🠖", rest: "bcde"});
            });
            it("fails at the end of input", () => {
                expect(
                    () => P.parseOnly(P.anyChar, "")
                ).to.throw;
            });
        });
        describe("satisfy", () => {
            it("parses whatever character the predicate returns true", () => {
                expect(
                    P.parse(P.satisfy(c => c == "🠖"), "🠖bcde")
                ).to.deep.equal({done: "🠖", rest: "bcde"});
            });
            it("fails if the predicate returns false", () => {
                expect(
                    () => P.parseOnly(P.satisfy(c => c == "🠖"), "abcde")
                ).to.throw;
            });
        });
    });
    describe("Lookahead", () => {
        describe("peekChar", () => {
            it("parses any character but doesn't consume input", () => {
                expect(
                    P.parse(P.peekChar, "🠖bcde")
                ).to.deep.equal({done: "🠖", rest: "🠖bcde"});
            });
            it("parses `undefined' at the end of input", () => {
                expect(
                    P.parseOnly(P.peekChar, "")
                ).to.be.undefined;
            });
        });
    });
    describe("Special characters", () => {
        describe("asciiDigit", () => {
            it("parses an ASCII digit", () => {
                expect(
                    P.parseOnly(P.asciiDigit, "1bcde")
                ).to.equal("1");
            });
            it("doesn't accept anything other than ASCII digits", () => {
                expect(
                    () => P.parseOnly(P.asciiDigit, "abcde")
                ).to.throw;
            });
        });
        describe("asciiAlpha", () => {
            it("parses an ASCII alphabet", () => {
                expect(
                    P.parseOnly(P.asciiAlpha, "abcde")
                ).to.equal("a");
            });
            it("doesn't accept anything other than ASCII alphabets", () => {
                expect(
                    () => P.parseOnly(P.asciiAlpha, "1bcde")
                ).to.throw;
            });
        });
        describe("asciiSpace", () => {
            it("parses an ASCII whitespace", () => {
                expect(
                    P.parseOnly(P.asciiSpace, " bcde")
                ).to.equal(" ");
            });
            it("doesn't accept anything other than ASCII whitespaces", () => {
                expect(
                    () => P.parseOnly(P.asciiSpace, "abcde")
                ).to.throw;
            });
        });
    });
    describe("RegExp", () => {
        describe("match", () => {
            it("parses any character that matches a given RegExp", () => {
                expect(
                    P.parseOnly(P.match(/[0-9]/), "1bcde")
                ).to.equal("1");
            });
            it("doesn't accept characters that doesn't match a given RegExp", () => {
                expect(
                    () => P.parseOnly(P.match(/[0-9]/), "abcde")
                ).to.throw;
            });
        });
        describe("noMatch", () => {
            it("parses any character that doesn't match a given RegExp", () => {
                expect(
                    P.parseOnly(P.noMatch(/[0-9]/), "abcde")
                ).to.equal("a");
            });
            it("doesn't accept characters that matches a given RegExp", () => {
                expect(
                    () => P.parseOnly(P.match(/[0-9]/), "1bcde")
                ).to.throw;
            });
        });
    });
    describe("Strings", () => {
        describe("literal", () => {
            it("parses a string that is given as a literal", () => {
                expect(
                    P.parse(P.literal("🠖bc"), "🠖bcde")
                ).to.deep.equal({done: "🠖bc", rest: "de"});
            });
            it("fails if the input doesn't start with the given string", () => {
                expect(
                    () => P.parseOnly(P.literal("🠖bc"), "abcde")
                ).to.throw;
            });
        });
        describe("skipAsciiSpaces", () => {
            it("skips over ASCII whitespaces", () => {
                expect(
                    P.parse(P.skipAsciiSpaces, "  ab")
                ).to.deep.equal({done: null, rest: "ab"});
            });
        });
        describe("skipWhile", () => {
            it("skips while the given predicate returns true", () => {
                expect(
                    P.parse(P.skipWhile(P.isAsciiDigit), "12ab")
                ).to.deep.equal({done: null, rest: "ab"});
            });
        });
        describe("take", () => {
            it("consumes a specific number of characters", () => {
                expect(
                    P.parse(P.take(3), "🠖bcde")
                ).to.deep.equal({done: "🠖bc", rest: "de"});
            });
        });
        describe("scan", () => {
            it("consumes characters until the state becomes undefined", () => {
                expect(
                    P.parse(P.scan(0, n => n < 3 ? n + 1 : undefined), "🠖bcde")
                ).to.deep.equal({done: "🠖bc", rest: "de"});
            });
        });
        describe("takeWhile", () => {
            it("consumes characters until the predicate returns false", () => {
                expect(
                    P.parse(P.takeWhile(c => c === "🠖"), "🠖🠖cde")
                ).to.deep.equal({done: "🠖🠖", rest: "cde"});
            });
            it("also succeeds when no characters satisfy the predicate", () => {
                expect(
                    P.parse(P.takeWhile(c => c === "🠖"), "abcde")
                ).to.deep.equal({done: "", rest: "abcde"});
            });
        });
        describe("takeWhile1", () => {
            it("consumes characters until the predicate returns false", () => {
                expect(
                    P.parse(P.takeWhile1(c => c === "🠖"), "🠖🠖cde")
                ).to.deep.equal({done: "🠖🠖", rest: "cde"});
            });
            it("fails when no characters satisfy the predicate", () => {
                expect(
                    () => P.parseOnly(P.takeWhile1(c => c === "🠖"), "abcde")
                ).to.throw;
            });
        });
        describe("takeTill", () => {
            it("consumes characters until the predicate returns true", () => {
                expect(
                    P.parse(P.takeTill(c => c !== "🠖"), "🠖🠖cde")
                ).to.deep.equal({done: "🠖🠖", rest: "cde"});
            });
            it("also succeeds when the first character satisfies the predicate", () => {
                expect(
                    P.parse(P.takeTill(c => c !== "🠖"), "abcde")
                ).to.deep.equal({done: "", rest: "abcde"});
            });
        });
    });
    describe("Consuming all remaining input", () => {
        describe("takeRest", () => {
            it("consumes all the remaining input", () => {
                expect(
                    P.parseOnly(P.takeRest, "🠖bcde")
                ).to.equal("🠖bcde");
            });
        });
    });
    describe("Text parsing", () => {
        describe("endOfLine", () => {
            it("consumes newline", () => {
                expect(
                    P.parse(P.endOfLine, "\r\nabc")
                ).to.deep.equal({done: "\r\n", rest: "abc"});
            });
        });
    });
    describe("Numeric parsers", () => {
        describe("decimal", () => {
            it("parses an unsigned decimal number", () => {
                expect(
                    P.parse(P.decimal, "123abc")
                ).to.deep.equal({done: 123, rest: "abc"});
            });
        });
        describe("hexadecimal", () => {
            it("parses an unsigned hexadecimal number", () => {
                expect(
                    P.parse(P.hexadecimal, "123a🠖")
                ).to.deep.equal({done: 0x123A, rest: "🠖"});
            });
        });
        describe("signed", () => {
            it("turns an unsigned parser into a signed one", () => {
                expect(
                    P.parse(P.signed(P.decimal), "-123abc")
                ).to.deep.equal({done: -123, rest: "abc"});
            });
        });
        describe("float", () => {
            it("parses a floating point number", () => {
                expect(
                    P.parse(P.float, "-1.23e-4abc")
                ).to.deep.equal({done: -1.23e-4, rest: "abc"});
            });
        });
    });
    describe("Combinators", () => {
        describe("choice", () => {
            it("folds a list of parsers with .orElse()", () => {
                expect(
                    P.parse(P.choice([
                        P.literal("abc"),
                        P.literal("abd")
                    ]), "abdefg")
                ).to.deep.equal({done: "abd", rest: "efg"});
            });
        });
        describe("count", () => {
            it("applies a parser `n' times", () => {
                expect(
                    P.parse(P.count(3, P.anyChar), "foobar")
                ).to.deep.equal({done: ["f", "o", "o"], rest: "bar"});
            });
        });
        describe("option", () => {
            it("fallbacks with a default value", () => {
                expect(
                    P.parse(P.option("foo", P.literal("bar")), "abcdef")
                ).to.deep.equal({done: "foo", rest: "abcdef"});
            });
        });
        describe("many", () => {
            it("applies a parser zero or more times", () => {
                expect(
                    P.parse(P.many(P.satisfy(c => c === "f" || c === "o")), "foobar")
                ).to.deep.equal({done: ["f", "o", "o"], rest: "bar"});
            });
            it("succeeds even if the parser never does", () => {
                expect(
                    P.parse(P.many(P.literal("bar")), "foobar")
                ).to.deep.equal({done: [], rest: "foobar"});
            });
            it("throws if the given parser succeeds without consuming input", () => {
                expect(
                    () => P.parse(P.many(P.peekChar), "foobar")
                ).to.throw;
            });
        });
        describe("many1", () => {
            it("applies a parser one or more times", () => {
                expect(
                    P.parse(P.many1(P.satisfy(c => c === "f" || c === "o")), "foobar")
                ).to.deep.equal({done: ["f", "o", "o"], rest: "bar"});
            });
            it("fails if the parser doesn't succeed even once", () => {
                expect(
                    () => P.parse(P.many1(P.literal("bar")), "foobar")
                ).to.throw;
            });
            it("throws if the given parser succeeds without consuming input", () => {
                expect(
                    () => P.parse(P.many1(P.peekChar), "foobar")
                ).to.throw;
            });
        });
        describe("manyTill", () => {
            it("continually applies a parser until `end' succeeds", () => {
                expect(
                    P.parse(P.manyTill(P.literal("ab"), P.literal("cd")), "ababcdefg")
                ).to.deep.equal({done: ["ab", "ab"], rest: "efg"});
            });
            it("succeeds even if the parser never does", () => {
                expect(
                    P.parse(P.manyTill(P.literal("ab"), P.literal("cd")), "cdefg")
                ).to.deep.equal({done: [], rest: "efg"});
            });
            it("throws if the given parser succeeds without consuming input", () => {
                expect(
                    () => P.parse(P.manyTill(P.peekChar, P.anyChar), "foobar")
                ).to.throw;
            });
        });
        describe("sepBy", () => {
            it("applies a parser zero or more times, separated by another parser", () => {
                expect(
                    P.parse(P.sepBy(P.literal("foo"), P.literal(",")), "foo,foo,bar")
                ).to.deep.equal({done: ["foo", "foo"], rest: ",bar"});
            });
            it("succeeds even if no separators exist", () => {
                expect(
                    P.parse(P.sepBy(P.literal("foo"), P.literal(",")), "foobar")
                ).to.deep.equal({done: ["foo"], rest: "bar"});
            });
            it("succeeds even if the parser never does", () => {
                expect(
                    P.parse(P.sepBy(P.literal("foo"), P.literal(",")), "bar")
                ).to.deep.equal({done: [], rest: "bar"});
            });
            it("throws if both parsers succeed without consuming input", () => {
                expect(
                    () => P.parse(P.sepBy(P.peekChar, P.peekChar), "foobar")
                ).to.throw;
            });
        });
        describe("sepBy1", () => {
            it("applies a parser one or more times, separated by another parser", () => {
                expect(
                    P.parse(P.sepBy1(P.literal("foo"), P.literal(",")), "foo,foo,bar")
                ).to.deep.equal({done: ["foo", "foo"], rest: ",bar"});
            });
            it("succeeds even if no separators exist", () => {
                expect(
                    P.parse(P.sepBy1(P.literal("foo"), P.literal(",")), "foobar")
                ).to.deep.equal({done: ["foo"], rest: "bar"});
            });
            it("fails if the parser doesn't succeed even once", () => {
                expect(
                    () => P.parse(P.sepBy1(P.literal("foo"), P.literal(",")), "bar")
                ).to.throw;
            });
            it("throws if both parsers succeed without consuming input", () => {
                expect(
                    () => P.parse(P.sepBy1(P.peekChar, P.peekChar), "foobar")
                ).to.throw;
            });
        });
        describe("skipMany", () => {
            it("applies a parser zero or more times, and discards the result", () => {
                expect(
                    P.parse(P.skipMany(P.satisfy(c => c === "f" || c === "o")), "foobar")
                ).to.deep.equal({done: null, rest: "bar"});
            });
            it("succeeds even if the parser never does", () => {
                expect(
                    P.parse(P.skipMany(P.literal("bar")), "foobar")
                ).to.deep.equal({done: null, rest: "foobar"});
            });
            it("throws if the given parser succeeds without consuming input", () => {
                expect(
                    () => P.parse(P.skipMany(P.peekChar), "foobar")
                ).to.throw;
            });
        });
        describe("skipMany1", () => {
            it("applies a parser one or more times, and discards the result", () => {
                expect(
                    P.parse(P.skipMany1(P.satisfy(c => c === "f" || c === "o")), "foobar")
                ).to.deep.equal({done: null, rest: "bar"});
            });
            it("fails if the parser doesn't succeed even once", () => {
                expect(
                    () => P.parse(P.skipMany1(P.literal("bar")), "foobar")
                ).to.throw;
            });
            it("throws if the given parser succeeds without consuming input", () => {
                expect(
                    () => P.parse(P.skipMany1(P.peekChar), "foobar")
                ).to.throw;
            });
        });
    });
    describe("State observation", () => {
        describe("endOfInput", () => {
            it("succeeds at the end of input", () => {
                expect(
                    P.parseOnly(P.endOfInput, "")
                ).to.be.null;
            });
            it("fails if there is input", () => {
                expect(
                    () => P.parse(P.endOfInput, "foo")
                ).to.throw;
            });
        });
        describe("atEnd", () => {
            it("returns true at the end of input", () => {
                expect(
                    P.parseOnly(P.atEnd, "")
                ).to.be.true;
            });
            it("returns false if there is input", () => {
                expect(
                    P.parse(P.atEnd, "foo")
                ).to.deep.equal({done: false, rest: "foo"});
            });
        });
    });
});
