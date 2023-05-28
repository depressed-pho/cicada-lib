import "mocha";
import { expect } from "chai";
import { Queue } from "../lib/queue.js";

describe("Queue", () => {
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
    });
});
