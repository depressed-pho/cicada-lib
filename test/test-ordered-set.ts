import "mocha";
import { expect } from "chai";
import { OrdSet } from "../lib/ordered-set.js";

describe("OrdSet", () => {
    describe("Query", () => {
        describe("prototype.size", () => {
            it("returns the size of a set", () => {
                expect(new OrdSet().size).to.equal(0);
                expect(new OrdSet(["foo", "bar"]).size).to.equal(2);
            });
        });
        describe(".prototype.has", () => {
            it("checks the existence of an element", () => {
                const s = new OrdSet(["foo", "bar"]);
                expect(s.has("foo")).to.be.true;
                expect(s.has("bar")).to.be.true;
                expect(s.has("baz")).to.be.false;
            });
        });
        describe(".prototype.getLessThan", () => {
            it("returns the largest element smaller than the given one", () => {
                const s = new OrdSet([1, 2, 3]);
                expect(s.getLessThan(5)).to.deep.equal(3);
                expect(s.getLessThan(3)).to.deep.equal(2);
                expect(s.getLessThan(1)).to.be.undefined;
            });
        });
        describe(".prototype.getGreaterThan", () => {
            it("returns the smallest element larger than the given one", () => {
                const s = new OrdSet([1, 2, 3]);
                expect(s.getGreaterThan(0)).to.deep.equal(1);
                expect(s.getGreaterThan(1)).to.deep.equal(2);
                expect(s.getGreaterThan(3)).to.be.undefined;
            });
        });
        describe(".prototype.getLessThanEqual", () => {
            it("returns the largest element smaller than or equal to the given one", () => {
                const s = new OrdSet([1, 2, 3]);
                expect(s.getLessThanEqual(5)).to.deep.equal(3);
                expect(s.getLessThanEqual(3)).to.deep.equal(3);
                expect(s.getLessThanEqual(0)).to.be.undefined;
            });
        });
        describe(".prototype.getGreaterThanEqual", () => {
            it("returns the smallest element larger than or equal to the given one", () => {
                const s = new OrdSet([1, 2, 3]);
                expect(s.getGreaterThanEqual(0)).to.deep.equal(1);
                expect(s.getGreaterThanEqual(1)).to.deep.equal(1);
                expect(s.getGreaterThanEqual(5)).to.be.undefined;
            });
        });
    });
    describe("construction", () => {
        describe("new with a compare function", () => {
            it("creates an empty set with a custom ordering", () => {
                const s = new OrdSet((a: any, b: any) => a.id - b.id);
                expect(s.size).to.equal(0);

                s.add({id: 0, str: "foo"});
                s.add({id: 1, str: "bar"});
                s.add({id: 1, str: "baz"});
                expect(Array.from(s)).to.deep.equal([
                    {id: 0, str: "foo"},
                    {id: 1, str: "baz"}
                ]);
            });
        });
        describe("new with an iterable container of elements", () => {
            it("creates an set with given elements", () => {
                const s = new OrdSet([1, 2, 3]);
                expect(s.size).to.equal(3);
                expect(Array.from(s)).to.deep.equal([1, 2, 3]);
            });
        });
    });
    describe("insertion", () => {
        describe(".prototype.add", () => {
            it("inserts a new element", () => {
                const s = new OrdSet([1]);
                s.add(2);

                expect(s.size).to.equal(2);
                expect(s.has(2)).to.be.true;
            });
            it("replaces an old value equivalent to the new one", () => {
                const s = new OrdSet([1]);
                s.add(1);

                expect(s.size).to.equal(1);
                expect(s.has(1)).to.be.true;
            });
        });
    });
    describe("deletion", () => {
        describe(".prototype.delete", () => {
            it("deletes an element if it exists", () => {
                const s = new OrdSet(["foo", "bar", "baz"]);

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
                const s1 = new OrdSet([1, 2]);
                const s2 = new OrdSet([2, 3]);
                expect(Array.from(s1.union(s2))).to.deep.equal([1, 2, 3]);
            });
            it("can also take the union of more than two sets", () => {
                const s0 = new OrdSet([0]);
                const s1 = new OrdSet([1, 2]);
                const s2 = new OrdSet([2, 3]);
                expect(Array.from(s0.union([s1, s2]))).to.deep.equal([0, 1, 2, 3]);
            });
        });
        describe(".prototype.difference", () => {
            it("takes the difference of \"this\" and another set", () => {
                const s1 = new OrdSet([1, 2]);
                const s2 = new OrdSet([2, 3]);
                expect(Array.from(s1.difference(s2))).to.deep.equal([1]);
            });
        });
        describe(".prototype.intersection", () => {
            it("takes the intersection of \"this\" and another set", () => {
                const s1 = new OrdSet([1, 2]);
                const s2 = new OrdSet([2, 3]);
                expect(Array.from(s1.intersection(s2))).to.deep.equal([2]);
            });
        });
        describe(".prototype.disjoint", () => {
            it("checks if \"this\" and another set are disjoint", () => {
                const s1 = new OrdSet([1, 2]);
                const s2 = new OrdSet([2, 3]);
                const s3 = new OrdSet([4, 5]);
                expect(s1.disjoint(s2)).to.be.false;
                expect(s1.disjoint(s3)).to.be.true;
            });
        });
    });
    describe("Traversal", () => {
        describe(".prototype.foldr", () => {
            it("folds values with a right-associative operator", () => {
                const s = new OrdSet([1, 2, 3]);
                const f = (e: number, acc: string) => e + "(" + acc + ")";
                expect(s.foldr(f, "#")).to.equal("1(2(3(#)))");
            });
        });
        describe(".prototype.foldl", () => {
            it("folds values with a left-associative operator", () => {
                const s = new OrdSet([1, 2, 3]);
                const f = (acc: string, e: number) => "(" + acc + ")" + e;
                expect(s.foldl(f, "#")).to.equal("(((#)1)2)3");
            });
        });
        describe(".prototype.any", () => {
            it("checks if there are any elements that satisfy a predicate", () => {
                const s = new OrdSet([1, 2, 3]);
                expect(s.any(n => n >= 3)).to.be.true;
                expect(s.any(n => n >= 4)).to.be.false;
            });
        });
        describe(".prototype.all", () => {
            it("checks if all of the elements satisfy a predicate", () => {
                const s = new OrdSet([1, 2, 3]);
                expect(s.all(n => n >= 1)).to.be.true;
                expect(s.all(n => n >= 2)).to.be.false;
            });
        });
    });
    describe("Iteration", () => {
        describe(".prototype.values", () => {
            it("iterates over elements in ascending order", () => {
                const s = new OrdSet(["foo", "bar", "baz"]);
                expect(Array.from(s.values())).to.deep.equal([
                    "bar", "baz", "foo"
                ]);
            });
            it("returns a reversible iterable iterator", () => {
                const s = new OrdSet(["foo", "bar", "baz"]);
                expect(Array.from(s.values().reverse())).to.deep.equal([
                    "foo", "baz", "bar"
                ]);
            });
        });
        describe(".prototype[@@iterator]", () => {
            it("returns this.values()", () => {
                const s = new OrdSet(["foo", "bar", "baz"]);
                expect(Array.from(s)).to.deep.equal([
                    "bar", "baz", "foo"
                ]);
            });
        });
        describe(".prototype.reverse", () => {
            it("returns this.values().reverse()", () => {
                const s = new OrdSet(["foo", "bar", "baz"]);
                expect(Array.from(s.reverse())).to.deep.equal([
                    "foo", "baz", "bar"
                ]);
            });
        });
    });
    describe("Filter", () => {
        describe(".prototype.filter", () => {
            it("returns a new set consisting of elements that satisfy a predicate", () => {
                const s = new OrdSet([1, 2, 3]);
                const p = (e: number) => e % 2 == 1;
                expect(Array.from(s.filter(p))).to.deep.equal([1, 3]);
            });
        });
        describe(".prototype.partition", () => {
            it("returns two sets consisting of elements that satisfy a predicate and those don't", () => {
                const s = new OrdSet([1, 2, 3]);
                const p = (e: number) => e % 2 == 1;
                const [s1, s2] = s.partition(p);
                expect(Array.from(s1)).to.deep.equal([1, 3]);
                expect(Array.from(s2)).to.deep.equal([2]);
            });
        });
        describe(".prototype.split", () => {
            it("splits a set based on an element", () => {
                const s = new OrdSet([1, 2, 3]);
                const [s1, b, s2] = s.split(2);
                expect(Array.from(s1)).to.deep.equal([1]);
                expect(b).to.be.true;
                expect(Array.from(s2)).to.deep.equal([3]);
            });
        });
    });
    describe("Indexed", () => {
        describe(".prototype.indexOf", () => {
            it("finds the index of a given element", () => {
                const s = new OrdSet(["foo", "bar", "baz"]);
                expect(s.indexOf("baz")).to.equal(1);
                expect(s.indexOf("qux")).to.be.undefined;
            });
        });
        describe(".prototype.elementAt", () => {
            it("retrieves an element by its index", () => {
                const s = new OrdSet(["foo", "bar", "baz"]);
                expect(s.elementAt(1)).to.deep.equal("baz");
                expect(s.elementAt(9)).to.be.undefined;
            });
        });
        describe(".prototype.take", () => {
            it("takes the first n elements", () => {
                const s = new OrdSet(["foo", "bar", "baz"]);
                expect(Array.from(s.take(2))).to.deep.equal(["bar", "baz"]);
            });
        });
        describe(".prototype.drop", () => {
            it("drops the first n elements", () => {
                const s = new OrdSet(["foo", "bar", "baz"]);
                expect(Array.from(s.drop(1))).to.deep.equal(["baz", "foo"]);
            });
        });
        describe(".prototype.splitAt", () => {
            it("splits the set at the given index", () => {
                const s = new OrdSet(["foo", "bar", "baz"]);
                const [s1, s2] = s.splitAt(1);
                expect(Array.from(s1)).to.deep.equal(["bar"]);
                expect(Array.from(s2)).to.deep.equal(["baz", "foo"]);
            });
        });
        describe(".prototype.deleteAt", () => {
            it("deletes the element at the given index", () => {
                const s = new OrdSet(["foo", "bar", "baz"]);
                s.deleteAt(1);
                s.deleteAt(9);
                expect(Array.from(s)).to.deep.equal(["bar", "foo"]);
            });
        });
    });
    describe("Min/Max", () => {
        describe(".prototype.minimum", () => {
            it("returns the minimal element", () => {
                const s1 = new OrdSet([1, 2, 3]);
                const s2 = new OrdSet();
                expect(s1.minimum()).to.deep.equal(1);
                expect(s2.minimum()).to.be.undefined;
            });
        });
        describe(".prototype.maximum", () => {
            it("returns the maximal element", () => {
                const s1 = new OrdSet([1, 2, 3]);
                const s2 = new OrdSet();
                expect(s1.maximum()).to.deep.equal(3);
                expect(s2.maximum()).to.be.undefined;
            });
        });
        describe(".prototype.deleteMin", () => {
            it("deletes the minimal element", () => {
                const s1 = new OrdSet([1, 2, 3]);
                const s2 = new OrdSet();
                s1.deleteMin();
                s2.deleteMin();
                expect(Array.from(s1)).to.deep.equal([2, 3]);
                expect(Array.from(s2)).to.deep.equal([]);
            });
        });
        describe(".prototype.deleteMax", () => {
            it("deletes the maximal element", () => {
                const s1 = new OrdSet([1, 2, 3]);
                const s2 = new OrdSet();
                s1.deleteMax();
                s2.deleteMax();
                expect(Array.from(s1)).to.deep.equal([1, 2]);
                expect(Array.from(s2)).to.deep.equal([]);
            });
        });
        describe(".prototype.minView", () => {
            it("splits the set into its minimal element and the rest", () => {
                const s1 = new OrdSet([1, 2, 3]);
                const [e1, rest1] = s1.minView()!;
                expect(e1).to.equal(1);
                expect(Array.from(rest1)).to.deep.equal([2, 3]);

                const s2 = new OrdSet();
                expect(s2.minView()).to.be.undefined;
            });
        });
        describe(".prototype.maxView", () => {
            it("splits the set into its minimal element and the rest", () => {
                const s1 = new OrdSet([1, 2, 3]);
                const [e1, rest1] = s1.maxView()!;
                expect(e1).to.equal(3);
                expect(Array.from(rest1)).to.deep.equal([1, 2]);

                const s2 = new OrdSet();
                expect(s2.maxView()).to.be.undefined;
            });
        });
    });
});
