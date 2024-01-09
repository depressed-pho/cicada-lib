import "mocha";
import { expect } from "chai";
import { FNV1a32 } from "../lib/fnv-hash.js";

function strToOctets(str: string): Uint8Array {
    return Uint8Array.from(
        Array.from(str).map(char => char.charCodeAt(0)));
}

describe("class FNV1a32", () => {
    it("can consume octets in order", () => {
        let x = new FNV1a32();
        x.update(0x00);
        x.update(0x01);
        expect(x.final()).to.equal(0x1076963A);
    });
    it("can digest chunks of octets", () => {
        const x = new FNV1a32();
        x.update(strToOctets("abcdefg"));
        expect(x.final()).to.equal(0x2A9EB737);
    });
});
