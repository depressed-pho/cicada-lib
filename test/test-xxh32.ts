import "mocha";
import { expect } from "chai";
import { XXH32, xxHash32 } from "../lib/xxhash.js";

function strToOctets(str: string): Uint8Array {
    return Uint8Array.from(
        Array.from(str).map(char => char.charCodeAt(0)));
}

describe("class XXH32", () => {
    it("can digest several chunks in order", () => {
        let x = new XXH32();
        x.update(strToOctets("abcdefghijklmnopqrst_"));
        x.update(strToOctets("bcdefghijklmnop"));
        x.update(strToOctets("*****"));
        expect(x.final()).to.equal(0xCCB6773A);
    });
    it("can digest large chunks at once", () => {
        const x = new XXH32();
        x.update(strToOctets("abcdefghijklmnopqrst_bcdefghijklmnop*****"));
        expect(x.final()).to.equal(0xCCB6773A);
    });
    it("can also consume a single octet at a time", () => {
        const x = new XXH32();
        x.update(0x61);
        expect(x.final()).to.equal(0x550d7456);
    });
});

describe("function xxHash32()", () => {
    it("accepts an empty input", () => {
        const d = xxHash32(Uint8Array.from([]));
        expect(d).to.equal(0x02CC5D05);
    });
    it("can digest a small chunk", () => {
        const d = xxHash32(Uint8Array.from([0x61, 0x62, 0x63, 0x64, 0x65]));
        expect(d).to.equal(0x9738F19B);
    });
});
