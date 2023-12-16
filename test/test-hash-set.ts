import "mocha";
import { expect } from "chai";
import { HashSet } from "../lib/collections/hash-set.js";

describe("HashSet", () => {
    describe("Query", () => {
        describe("prototype.size", () => {
            it("returns the size of a set", () => {
                expect(new HashSet().size).to.equal(0);
                expect(new HashSet(["foo", "bar"]).size).to.equal(2);
            });
        });
        describe(".prototype.has", () => {
            it("checks the existence of an element", () => {
                const s = new HashSet(["foo", "bar"]);
                expect(s.has("foo")).to.be.true;
                expect(s.has("bar")).to.be.true;
                expect(s.has("baz")).to.be.false;
            });
        });
    });
    describe("construction", () => {
        describe("new with an equality", () => {
            it("creates an empty set with a custom equality", () => {
                const s = new HashSet((a: any, b: any) => a.id === b.id);
                expect(s.size).to.equal(0);

                s.add({id: 0, str: "foo"});
                s.add({id: 1, str: "bar"});
                s.add({id: 1, str: "baz"});
                expect(s.size).to.equal(2);
                expect(s.has({id: 1})).be.true;
            });
        });
        describe("new with an iterable container of elements", () => {
            it("creates an set with given elements", () => {
                const s = new HashSet([1, 2, 3]);
                expect(s.size).to.equal(3);
            });
        });
    });
    describe("insertion", () => {
        describe(".prototype.add", () => {
            it("inserts a new element", () => {
                const s = new HashSet([1]);
                s.add(2);

                expect(s.size).to.equal(2);
            });
            it("replaces an old value equivalent to the new one", () => {
                const s = new HashSet([1]);
                s.add(1);

                expect(s.size).to.equal(1);
            });
        });
    });
    describe("deletion", () => {
        describe(".prototype.delete", () => {
            it("deletes an element if it exists", () => {
                const s = new HashSet(["foo", "bar", "baz"]);

                expect(s.delete("foo")).to.be.true;
                expect(s.has("foo")).to.be.false;

                expect(s.delete("qux")).to.be.false;
                expect(s.has("qux")).to.be.false;
            });
        });
    });
    describe("Combine", () => {
        describe(".prototype.union", () => {
            it("takes the union of \"this\" and another set", () => {
                const s1 = new HashSet([1, 2]);
                const s2 = new HashSet([2, 3]);
                expect(s1.union(s2).size).to.equal(3);
            });
        });
        describe(".prototype.difference", () => {
            it("takes the difference of \"this\" and another set", () => {
                const s1 = new HashSet([1, 2]);
                const s2 = new HashSet([2, 3]);
                expect(s1.difference(s2).size).to.equal(1);
            });
        });
        describe(".prototype.intersection", () => {
            it("takes the intersection of \"this\" and another set", () => {
                const s1 = new HashSet([1, 2]);
                const s2 = new HashSet([2, 3]);
                expect(s1.intersection(s2).size).to.equal(1);
            });
        });
        describe(".prototype.isDisjointFrom", () => {
            it("checks if \"this\" and another set are disjoint", () => {
                const s1 = new HashSet([1, 2]);
                const s2 = new HashSet([2, 3]);
                const s3 = new HashSet([4, 5]);
                expect(s1.isDisjointFrom(s2)).to.be.false;
                expect(s1.isDisjointFrom(s3)).to.be.true;
            });
        });
    });
    describe("Iteration", () => {
        describe(".prototype.values", () => {
            it("iterates over elements", () => {
                const s = new HashSet(["foo", "bar", "baz"]);
                expect(Array.from(s.values())).to.have.lengthOf(3);
            });
        });
        describe(".prototype[@@iterator]", () => {
            it("returns this.values()", () => {
                const s = new HashSet(["foo", "bar", "baz"]);
                expect(Array.from(s.values())).to.have.lengthOf(3);
            });
        });
    });
});
