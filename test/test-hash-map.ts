import "mocha";
import { expect } from "chai";
import { HashMap } from "../lib/collections/hash-map.js";

describe("HashMap", () => {
    describe("Query", () => {
        describe("prototype.size", () => {
            it("returns the size of a map", () => {
                expect(new HashMap().size).to.equal(0);
                expect(new HashMap([["foo", 1], ["bar", 2]]).size).to.equal(2);
            });
        });
        describe(".prototype.get", () => {
            it("looks up a value in a map", () => {
                const m = new HashMap([["foo", 1], ["bar", 2]]);
                expect(m.get("foo")).to.equal(1);
                expect(m.get("bar")).to.equal(2);
                expect(m.get("baz")).to.be.undefined;
            });
        });
        describe(".prototype.has", () => {
            it("checks the existence of a key", () => {
                const m = new HashMap([["foo", 1], ["bar", 2]]);
                expect(m.has("foo")).to.be.true;
                expect(m.has("bar")).to.be.true;
                expect(m.has("baz")).to.be.false;
            });
        });
    });
    describe("construction", () => {
        describe("new with an equality", () => {
            it("creates an empty map with a custom equality", () => {
                const m = new HashMap((a: any, b: any) => a.id === b.id);
                expect(m.size).to.equal(0);

                m.set({id: 0, str: "foo"}, "foobar");
                m.set({id: 1, str: "bar"}, "barbaz");
                m.set({id: 1, str: "baz"}, "bazqux");
                expect(m.size).to.equal(2);
                expect(m.get({id: 1})).to.equal("bazqux");
            });
        });
        describe("new with an iterable container of pairs", () => {
            it("creates an map with given key/value pairs", () => {
                const m = new HashMap([[1, "foo"], [2, "bar"], [3, "baz"]]);
                expect(m.size).to.equal(3);
                expect(m.get(1)).to.equal("foo");
                expect(m.get(2)).to.equal("bar");
                expect(m.get(3)).to.equal("baz");
            });
        });
    });
    describe("insertion", () => {
        describe(".prototype.set", () => {
            it("inserts a new key/value pair", () => {
                const m = new HashMap([[1, "foo"]]);
                m.set(2, "bar");

                expect(m.size).to.equal(2);
                expect(m.get(2)).to.equal("bar");
            });
            it("replaces an old value with the same key", () => {
                const m = new HashMap([[1, "foo"]]);
                m.set(1, "bar");

                expect(m.size).to.equal(1);
                expect(m.get(1)).to.equal("bar");
            });
            it("combines an old and a new value with the same key", () => {
                const m = new HashMap([[1, "foo"]]);
                m.set(1, "bar", (oldVal, newVal) => oldVal + newVal);

                expect(m.size).to.equal(1);
                expect(m.get(1)).to.equal("foobar");
            });
        });
    });
    describe("deletion and update", () => {
        describe(".prototype.clear", () => {
            it("deletes all keys", () => {
                const m = new HashMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                m.clear();
                expect(m.size).to.equal(0);
            });
        });
        describe(".prototype.delete", () => {
            it("deletes a key if it exists", () => {
                const m = new HashMap([["foo", 1], ["bar", 2], ["baz", 3]]);

                expect(m.delete("foo")).to.be.true;
                expect(m.has("foo")).to.be.false;

                expect(m.delete("qux")).to.be.false;
                expect(m.has("qux")).to.be.false;
            });
        });
        describe(".prototype.deleteAny", () => {
            it("deletes a single entry if any", () => {
                const m = new HashMap([["foo", 1], ["bar", 2], ["baz", 3]]);

                expect(m.deleteAny()).to.be.an("array").and.has.lengthOf(2);
                expect(m.size).to.equal(2);
            });
        });
    });
    describe("Iteration", () => {
        describe(".prototype.keys", () => {
            it("iterates over keys", () => {
                const m = new HashMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                expect(Array.from(m.keys())).to.have.lengthOf(3);
            });
        });
        describe(".prototype.values", () => {
            it("iterates over values", () => {
                const m = new HashMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                expect(Array.from(m.values())).to.have.lengthOf(3);
            });
        });
        describe(".prototype.entries", () => {
            it("iterates over key/value pairs", () => {
                const m = new HashMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                expect(Array.from(m.entries())).to.have.lengthOf(3);
            });
        });
        describe(".prototype[@@iterator]", () => {
            it("returns this.entries()", () => {
                const m = new HashMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                expect(Array.from(m)).to.have.lengthOf(3);
            });
        });
    });
});
