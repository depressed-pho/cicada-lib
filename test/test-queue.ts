import "mocha";
import { expect } from "chai";
import { Queue } from "../lib/collections/queue.js";

describe("Queue", () => {
    describe("Construction", () => {
        describe(".prototype.concat", () => {
            it("concatenates two or more queues", () => {
                const q1 = Queue.from([0, 1, 2]);
                const q2 = Queue.from([3, 4]);
                expect(Array.from(q1.concat(q2))).to.deep.equal([0, 1, 2, 3, 4]);
            });
        });
    });
    describe("Sub-queues", () => {
        describe(".prototype.spanl", () => {
            it("returns the longest prefix and the remainder", () => {
                const q = Queue.from([0, 1, 2, 3, 4]);
                const [q1, q2] = q.spanl(n => n <= 2);
                expect(Array.from(q1)).to.deep.equal([0, 1, 2]);
                expect(Array.from(q2)).to.deep.equal([3, 4]);
            });
        });
        describe(".prototype.spanr", () => {
            it("returns the longest suffix and the remainder", () => {
                const q = Queue.from([0, 1, 2, 3, 4]);
                const [q1, q2] = q.spanr(n => n > 2);
                expect(Array.from(q1)).to.deep.equal([3, 4]);
                expect(Array.from(q2)).to.deep.equal([0, 1, 2]);
            });
        });
        describe(".prototype.breakl", () => {
            it("returns the longest prefix and the remainder", () => {
                const q = Queue.from([0, 1, 2, 3, 4]);
                const [q1, q2] = q.breakl(n => n > 2);
                expect(Array.from(q1)).to.deep.equal([0, 1, 2]);
                expect(Array.from(q2)).to.deep.equal([3, 4]);
            });
        });
        describe(".prototype.breakr", () => {
            it("returns the longest suffix and the remainder", () => {
                const q = Queue.from([0, 1, 2, 3, 4]);
                const [q1, q2] = q.breakr(n => n <= 2);
                expect(Array.from(q1)).to.deep.equal([3, 4]);
                expect(Array.from(q2)).to.deep.equal([0, 1, 2]);
            });
        });
        describe(".prototype.filter", () => {
            it("returns elements that satisfy a predicate", () => {
                const q = Queue.from([0, 1, 2, 3, 4]);
                expect(Array.from(q.filter(n => n % 2 == 0))).to.deep.equal([0, 2, 4]);
            });
        });
        describe(".prototype.partition", () => {
            it("returns two queues consisting of elements that satisfy a predicate and those that don't", () => {
                const q = Queue.from([0, 1, 2, 3, 4]);
                const [q1, q2] = q.partition(n => n % 2 == 0);
                expect(Array.from(q1)).to.deep.equal([0, 2, 4]);
                expect(Array.from(q2)).to.deep.equal([1, 3]);
            });
        });
    });
    describe("Indexing", () => {
        describe(".prototype.take", () => {
            it("takes the first n elements", () => {
                const q = Queue.from([0, 1, 2, 3, 4]);
                expect(Array.from(q.take(3))).to.deep.equal([0, 1, 2]);
            });
        });
        describe(".prototype.drop", () => {
            it("drops the first n elements", () => {
                const q = Queue.from([0, 1, 2, 3, 4]);
                expect(Array.from(q.drop(3))).to.deep.equal([3, 4]);
            });
        });
    });
    describe("Folds", () => {
        describe(".prototype.any", () => {
            it("checks if there are any elements that satisfy a predicate", () => {
                const q = Queue.from([0, 1, 2, 3, 4]);
                expect(q.any(n => n >= 4)).to.be.true;
                expect(q.any(n => n >= 5)).to.be.false;
            });
        });
        describe(".prototype.all", () => {
            it("checks if all of the elements satisfy a predicate", () => {
                const q = Queue.from([0, 1, 2, 3, 4]);
                expect(q.all(n => n >= 0)).to.be.true;
                expect(q.all(n => n >= 1)).to.be.false;
            });
        });
    });
});
