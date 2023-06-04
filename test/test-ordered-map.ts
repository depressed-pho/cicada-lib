import "mocha";
import { expect } from "chai";
import { OrdMap } from "../lib/ordered-map.js";
import { OrdSet } from "../lib/ordered-set.js";

describe("OrdMap", () => {
    describe("Query", () => {
        describe("prototype.size", () => {
            it("returns the size of a map", () => {
                expect(new OrdMap().size).to.equal(0);
                expect(new OrdMap([["foo", 1], ["bar", 2]]).size).to.equal(2);
            });
        });
        describe(".prototype.get", () => {
            it("looks up a value in a map", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2]]);
                expect(m.get("foo")).to.equal(1);
                expect(m.get("bar")).to.equal(2);
                expect(m.get("baz")).to.be.undefined;
            });
        });
        describe(".prototype.has", () => {
            it("checks the existence of a key", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2]]);
                expect(m.has("foo")).to.be.true;
                expect(m.has("bar")).to.be.true;
                expect(m.has("baz")).to.be.false;
            });
        });
        describe(".prototype.getLessThan", () => {
            it("returns the largest key/value smaller than the given one", () => {
                const m = new OrdMap([[3, "foo"], [2, "bar"], [1, "baz"]]);
                expect(m.getLessThan(5)).to.deep.equal([3, "foo"]);
                expect(m.getLessThan(3)).to.deep.equal([2, "bar"]);
                expect(m.getLessThan(1)).to.be.undefined;
            });
        });
        describe(".prototype.getGreaterThan", () => {
            it("returns the smallest key/value larger than the given one", () => {
                const m = new OrdMap([[3, "foo"], [2, "bar"], [1, "baz"]]);
                expect(m.getGreaterThan(0)).to.deep.equal([1, "baz"]);
                expect(m.getGreaterThan(1)).to.deep.equal([2, "bar"]);
                expect(m.getGreaterThan(3)).to.be.undefined;
            });
        });
        describe(".prototype.getLessThanEqual", () => {
            it("returns the largest key/value smaller than or equal to the given one", () => {
                const m = new OrdMap([[3, "foo"], [2, "bar"], [1, "baz"]]);
                expect(m.getLessThanEqual(5)).to.deep.equal([3, "foo"]);
                expect(m.getLessThanEqual(3)).to.deep.equal([3, "foo"]);
                expect(m.getLessThanEqual(0)).to.be.undefined;
            });
        });
        describe(".prototype.getGreaterThanEqual", () => {
            it("returns the smallest key/value larger than or equal to the given one", () => {
                const m = new OrdMap([[3, "foo"], [2, "bar"], [1, "baz"]]);
                expect(m.getGreaterThanEqual(0)).to.deep.equal([1, "baz"]);
                expect(m.getGreaterThanEqual(1)).to.deep.equal([1, "baz"]);
                expect(m.getGreaterThanEqual(5)).to.be.undefined;
            });
        });
    });
    describe("construction", () => {
        describe("new with a compare function", () => {
            it("creates an empty map with a custom ordering", () => {
                const m = new OrdMap((a: any, b: any) => a.id - b.id);
                expect(m.size).to.equal(0);

                m.set({id: 0, str: "foo"}, "foobar");
                m.set({id: 1, str: "bar"}, "barbaz");
                expect(Array.from(m)).to.deep.equal([
                    [{id: 0, str: "foo"}, "foobar"],
                    [{id: 1, str: "bar"}, "barbaz"]
                ]);
            });
        });
        describe("new with an iterable container of pairs", () => {
            it("creates an map with given key/value pairs", () => {
                const m = new OrdMap([[1, "foo"], [2, "bar"], [3, "baz"]]);
                expect(m.size).to.equal(3);
                expect(Array.from(m)).to.deep.equal([
                    [1, "foo"], [2, "bar"], [3, "baz"]
                ]);
            });
        });
    });
    describe("insertion", () => {
        describe(".prototype.set", () => {
            it("inserts a new key/value pair", () => {
                const m = new OrdMap([[1, "foo"]]);
                m.set(2, "bar");

                expect(m.size).to.equal(2);
                expect(m.get(2)).to.equal("bar");
            });
            it("replaces an old value with the same key", () => {
                const m = new OrdMap([[1, "foo"]]);
                m.set(1, "bar");

                expect(m.size).to.equal(1);
                expect(m.get(1)).to.equal("bar");
            });
            it("combines an old and a new value with the same key", () => {
                const m = new OrdMap([[1, "foo"]]);
                m.set(1, "bar", (oldVal, newVal) => oldVal + newVal);

                expect(m.size).to.equal(1);
                expect(m.get(1)).to.equal("foobar");
            });
        });
    });
    describe("deletion and update", () => {
        describe(".prototype.delete", () => {
            it("deletes a key if it exists", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);

                expect(m.delete("foo")).to.be.true;
                expect(m.has("foo")).to.be.false;

                expect(m.delete("qux")).to.be.false;
                expect(m.has("qux")).to.be.false;
            });
        });
        describe(".prototype.deleteKeys", () => {
            it("deletes all the keys in a container", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                const s = new OrdSet(["foo", "bar"]);
                m.deleteKeys(s);
                expect(Array.from(m)).to.deep.equal([
                    ["baz", 3]
                ]);
            });
        });
        describe(".prototype.restrictKeys", () => {
            it("retains all the keys in a container and deletes everything else", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                const s = new OrdSet(["foo", "bar"]);
                m.restrictKeys(s);
                expect(Array.from(m)).to.deep.equal([
                    ["bar", 2], ["foo", 1]
                ]);
            });
        });
        describe(".prototype.adjust", () => {
            it("applies a given function to an old value", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                m.adjust("foo", n => 10 * n);
                m.adjust("qux", n => 10 * n);
                expect(Array.from(m)).to.deep.equal([
                    ["bar", 2], ["baz", 3], ["foo", 10]
                ]);
            });
        });
        describe(".prototype.update", () => {
            it("applies a given function to an old value, and delete it if it returns undefined", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                m.update("foo", n => 10 * n);
                m.update("baz", () => undefined);
                expect(Array.from(m)).to.deep.equal([
                    ["bar", 2], ["foo", 10]
                ]);
            });
        });
        describe(".prototype.alter", () => {
            it("alters an old value or its absence thereof", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                m.alter("aaa", () => 666);       // insert
                m.alter("foo", n  => 10 * n!);   // update: this n! is NOT a factorial!
                m.alter("baz", () => undefined); // delete
                m.alter("zzz", () => undefined); // no-op
                expect(Array.from(m)).to.deep.equal([
                    ["aaa", 666], ["bar", 2], ["foo", 10]
                ]);
            });
        });
    });
    describe("Combine", () => {
        describe(".prototype.union", () => {
            it("takes the union of \"this\" and another map", () => {
                const m1 = new OrdMap([[1, "foo"], [2, "bar"]]);
                const m2 = new OrdMap([[2, "qux"], [3, "quux"]]);
                expect(Array.from(m1.union(m2))).to.deep.equal([
                    [1, "foo"], [2, "bar"], [3, "quux"]
                ]);
            });
            it("accepts a combiner function", () => {
                const m1 = new OrdMap([[1, "foo"], [2, "bar"]]);
                const m2 = new OrdMap([[2, "qux"], [3, "quux"]]);
                const cb = (v2: string, v1: string) => v2 + v1;
                expect(Array.from(m1.union(m2, cb))).to.deep.equal([
                    [1, "foo"], [2, "quxbar"], [3, "quux"]
                ]);
            });
            it("can also take the union of more than two maps", () => {
                const m0 = new OrdMap([[0, ""]]);
                const m1 = new OrdMap([[1, "foo"], [2, "bar"]]);
                const m2 = new OrdMap([[2, "qux"], [3, "quux"]]);
                expect(Array.from(m0.union([m1, m2]))).to.deep.equal([
                    [0, ""], [1, "foo"], [2, "bar"], [3, "quux"]
                ]);
            });
        });
        describe(".prototype.difference", () => {
            it("takes the difference of \"this\" and another map", () => {
                const m1 = new OrdMap([[1, "foo"], [2, "bar"]]);
                const m2 = new OrdMap([[2, "qux"], [3, "quux"]]);
                expect(Array.from(m1.difference(m2))).to.deep.equal([
                    [1, "foo"]
                ]);
            });
        });
        describe(".prototype.intersection", () => {
            it("takes the intersection of \"this\" and another map", () => {
                const m1 = new OrdMap([[1, "foo"], [2, "bar"]]);
                const m2 = new OrdMap([[2, "qux"], [3, "quux"]]);
                expect(Array.from(m1.intersection(m2))).to.deep.equal([
                    [2, "bar"]
                ]);
            });
        });
        describe(".prototype.disjoint", () => {
            it("checks if \"this\" and another map are disjoint", () => {
                const m1 = new OrdMap([[1, "foo"], [2, "bar"]]);
                const m2 = new OrdMap([[2, "qux"], [3, "quux"]]);
                const m3 = new OrdMap([[4, "xxx"], [5, "yyy"]]);
                expect(m1.disjoint(m2)).to.be.false;
                expect(m1.disjoint(m3)).to.be.true;
            });
        });
    });
    describe("Traversal", () => {
        describe(".prototype.map", () => {
            it("maps a function over values", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                const f = (n: number) => n * 10;
                expect(Array.from(m.map(f))).to.deep.equal([
                    ["bar", 20], ["baz", 30], ["foo", 10]
                ]);
            });
            it("removes elements that the function returns `undefined'", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                const f = (n: number) => n % 2 === 1 ? n * 10 : undefined;
                expect(Array.from(m.map(f))).to.deep.equal([
                    ["baz", 30], ["foo", 10]
                ]);
            });
        });
        describe(".prototype.foldr", () => {
            it("folds values with a right-associative operator", () => {
                const m = new OrdMap([[1, "foo"], [2, "bar"], [3, "baz"]]);
                const f = (v: string, acc: string) => v + "(" + acc + ")";
                expect(m.foldr(f, "#")).to.equal("foo(bar(baz(#)))");
            });
        });
        describe(".prototype.foldl", () => {
            it("folds values with a left-associative operator", () => {
                const m = new OrdMap([[1, "foo"], [2, "bar"], [3, "baz"]]);
                const f = (acc: string, v: string) => "(" + acc + ")" + v;
                expect(m.foldl(f, "#")).to.equal("(((#)foo)bar)baz");
            });
        });
        describe(".prototype.any", () => {
            it("checks if there are any elements that satisfy a predicate", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                expect(m.any(n => n >= 3)).to.be.true;
                expect(m.any(n => n >= 4)).to.be.false;
            });
        });
        describe(".prototype.all", () => {
            it("checks if all of the elements satisfy a predicate", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                expect(m.all(n => n >= 1)).to.be.true;
                expect(m.all(n => n >= 2)).to.be.false;
            });
        });
    });
    describe("Iteration", () => {
        describe(".prototype.keys", () => {
            it("iterates over keys in ascending order", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                expect(Array.from(m.keys())).to.deep.equal([
                    "bar", "baz", "foo"
                ]);
            });
            it("returns a reversible iterable iterator", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                expect(Array.from(m.keys().reverse())).to.deep.equal([
                    "foo", "baz", "bar"
                ]);
            });
        });
        describe(".prototype.values", () => {
            it("iterates over values in ascending order of their keys", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                expect(Array.from(m.values())).to.deep.equal([
                    2, 3, 1
                ]);
            });
            it("returns a reversible iterable iterator", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                expect(Array.from(m.values().reverse())).to.deep.equal([
                    1, 3, 2
                ]);
            });
        });
        describe(".prototype.entries", () => {
            it("iterates over key/value pairs in ascending order", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                expect(Array.from(m.entries())).to.deep.equal([
                    ["bar", 2], ["baz", 3], ["foo", 1]
                ]);
            });
            it("returns a reversible iterable iterator", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                expect(Array.from(m.entries().reverse())).to.deep.equal([
                    ["foo", 1], ["baz", 3], ["bar", 2]
                ]);
            });
        });
        describe(".prototype[@@iterator]", () => {
            it("returns this.entries()", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                expect(Array.from(m)).to.deep.equal([
                    ["bar", 2], ["baz", 3], ["foo", 1]
                ]);
            });
        });
        describe(".prototype.reverse", () => {
            it("returns this.entries().reverse()", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                expect(Array.from(m.reverse())).to.deep.equal([
                    ["foo", 1], ["baz", 3], ["bar", 2]
                ]);
            });
        });
        describe(".prototype.keysSet", () => {
            it("returns the set of keys", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                const s = m.keysSet();
                expect(Array.from(s)).to.deep.equal(["bar", "baz", "foo"]);
            });
        });
    });
    describe("Filter", () => {
        describe(".prototype.filter", () => {
            it("returns a new map consisting of elements that satisfy a predicate", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                const p = (v: number) => v % 2 == 1;
                expect(Array.from(m.filter(p))).to.deep.equal([
                    ["baz", 3], ["foo", 1]
                ]);
            });
        });
        describe(".prototype.partition", () => {
            it("returns two maps consisting of elements that satisfy a predicate and those that don't", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                const p = (v: number) => v % 2 == 1;
                const [m1, m2] = m.partition(p);
                expect(Array.from(m1)).to.deep.equal([
                    ["baz", 3], ["foo", 1]
                ]);
                expect(Array.from(m2)).to.deep.equal([
                    ["bar", 2]
                ]);
            });
        });
        describe(".prototype.split", () => {
            it("splits a map based on a key", () => {
                const m = new OrdMap([[1, "foo"], [2, "bar"], [3, "baz"]]);
                const [m1, v, m2] = m.split(2);
                expect(Array.from(m1)).to.deep.equal([ [1, "foo"] ]);
                expect(v).to.equal("bar");
                expect(Array.from(m2)).to.deep.equal([ [3, "baz"] ]);
            });
        });
    });
    describe("Indexed", () => {
        describe(".prototype.indexOf", () => {
            it("finds the index of a given key", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                expect(m.indexOf("baz")).to.equal(1);
                expect(m.indexOf("qux")).to.be.undefined;
            });
        });
        describe(".prototype.elementAt", () => {
            it("retrieves an element by its index", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                expect(m.elementAt(1)).to.deep.equal(["baz", 3]);
                expect(m.elementAt(9)).to.be.undefined;
            });
        });
        describe(".prototype.take", () => {
            it("takes the first n elements", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                expect(Array.from(m.take(2))).to.deep.equal([
                    ["bar", 2], ["baz", 3]
                ]);
            });
        });
        describe(".prototype.drop", () => {
            it("drops the first n elements", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                expect(Array.from(m.drop(1))).to.deep.equal([
                    ["baz", 3], ["foo", 1]
                ]);
            });
        });
        describe(".prototype.splitAt", () => {
            it("splits the map at the given index", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                const [m1, m2] = m.splitAt(1);
                expect(Array.from(m1)).to.deep.equal([
                    ["bar", 2]
                ]);
                expect(Array.from(m2)).to.deep.equal([
                    ["baz", 3], ["foo", 1]
                ]);
            });
        });
        describe(".prototype.updateAt", () => {
            it("updates the value at the given key index", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                m.updateAt(1, n => n * 10);
                m.updateAt(9, n => n * 10);
                expect(Array.from(m)).to.deep.equal([
                    ["bar", 2], ["baz", 30], ["foo", 1]
                ]);
            });
        });
        describe(".prototype.deleteAt", () => {
            it("deletes the value at the given key index", () => {
                const m = new OrdMap([["foo", 1], ["bar", 2], ["baz", 3]]);
                m.deleteAt(1);
                m.deleteAt(9);
                expect(Array.from(m)).to.deep.equal([
                    ["bar", 2], ["foo", 1]
                ]);
            });
        });
    });
    describe("Min/Max", () => {
        describe(".prototype.minimum", () => {
            it("returns the minimal element", () => {
                const m1 = new OrdMap([[1, "foo"], [2, "bar"], [3, "baz"]]);
                const m2 = new OrdMap();
                expect(m1.minimum()).to.deep.equal([1, "foo"]);
                expect(m2.minimum()).to.be.undefined;
            });
        });
        describe(".prototype.maximum", () => {
            it("returns the maximal element", () => {
                const m1 = new OrdMap([[1, "foo"], [2, "bar"], [3, "baz"]]);
                const m2 = new OrdMap();
                expect(m1.maximum()).to.deep.equal([3, "baz"]);
                expect(m2.maximum()).to.be.undefined;
            });
        });
        describe(".prototype.deleteMin", () => {
            it("deletes the minimal element", () => {
                const m1 = new OrdMap([[1, "foo"], [2, "bar"], [3, "baz"]]);
                const m2 = new OrdMap();
                m1.deleteMin();
                m2.deleteMin();
                expect(Array.from(m1)).to.deep.equal([
                    [2, "bar"], [3, "baz"]
                ]);
                expect(Array.from(m2)).to.deep.equal([]);
            });
        });
        describe(".prototype.deleteMax", () => {
            it("deletes the maximal element", () => {
                const m1 = new OrdMap([[1, "foo"], [2, "bar"], [3, "baz"]]);
                const m2 = new OrdMap();
                m1.deleteMax();
                m2.deleteMax();
                expect(Array.from(m1)).to.deep.equal([
                    [1, "foo"], [2, "bar"],
                ]);
                expect(Array.from(m2)).to.deep.equal([]);
            });
        });
        describe(".prototype.minView", () => {
            it("splits the map into its minimal element and the rest", () => {
                const m1 = new OrdMap([[1, "foo"], [2, "bar"], [3, "baz"]]);
                const [k1, v1, rest1] = m1.minView()!;
                expect(k1).to.equal(1);
                expect(v1).to.equal("foo");
                expect(Array.from(rest1)).to.deep.equal([
                    [2, "bar"], [3, "baz"]
                ]);

                const m2 = new OrdMap();
                expect(m2.minView()).to.be.undefined;
            });
        });
        describe(".prototype.maxView", () => {
            it("splits the map into its minimal element and the rest", () => {
                const m1 = new OrdMap([[1, "foo"], [2, "bar"], [3, "baz"]]);
                const [k1, v1, rest1] = m1.maxView()!;
                expect(k1).to.equal(3);
                expect(v1).to.equal("baz");
                expect(Array.from(rest1)).to.deep.equal([
                    [1, "foo"], [2, "bar"],
                ]);

                const m2 = new OrdMap();
                expect(m2.maxView()).to.be.undefined;
            });
        });
    });
});
