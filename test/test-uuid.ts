import "mocha";
import { expect } from "chai";
import { UUID }  from "../lib/uuid.js";

describe("UUID", () => {
    describe(".parse", () => {
        it("parses a UUID string", () => {
            const src  = "df15c249-38fe-4c65-a2fe-824f8be4d846";
            const uuid = UUID.parse(src);
            expect(uuid.toString()).to.equal(src);
        });
        it("parses big-endian UUID octets", () => {
            const src  = new Uint8Array(
                [0xDF, 0x15, 0xC2, 0x49,
                 0x38, 0xFE,
                 0x4C, 0x65,
                 0xA2, 0xFE,
                 0x82, 0x4F, 0x8B, 0xE4, 0xD8, 0x46]);
            const uuid = UUID.parse(src);
            expect(uuid.toString()).to.equal("df15c249-38fe-4c65-a2fe-824f8be4d846");
        });
    });
    describe(".nil", () => {
        it("creates a Nil UUID", () => {
            const uuid = UUID.nil();
            expect(uuid.toString()).to.equal("00000000-0000-0000-0000-000000000000");
        });
    });
    describe(".v1", () => {
        it("creates a v1 UUID", () => {
            const uuid = UUID.v1();
            expect(() => uuid.toString()).to.not.throw();
        });
    });
    describe(".v4", () => {
        it("creates a v4 UUID", () => {
            const uuid = UUID.v4();
            expect(() => uuid.toString()).to.not.throw();
        });
    });
    describe(".prototype.toString", () => {
        it("turns a UUID into a string", () => {
            const src  = "df15c249-38fe-4c65-a2fe-824f8be4d846";
            const uuid = UUID.parse(src);
            expect(uuid.toString()).to.equal(src);
        });
    });
    describe(".prototype.toOctets", () => {
        it("turns a UUID into big-endian octets", () => {
            const src  = "df15c249-38fe-4c65-a2fe-824f8be4d846";
            const uuid = UUID.parse(src);
            expect(uuid.toOctets()).to.deep.equal(
                new Uint8Array(
                    [0xDF, 0x15, 0xC2, 0x49,
                     0x38, 0xFE,
                     0x4C, 0x65,
                     0xA2, 0xFE,
                     0x82, 0x4F, 0x8B, 0xE4, 0xD8, 0x46]));
        });
    });
});
