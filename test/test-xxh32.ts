import "mocha";
import { expect } from "chai";
import { XXH32, xxHash32 } from "../lib/xxh32.js";

describe("class XXH32", () => {
    it("can digest several chunks in order", () => {
        var x = new XXH32();
        x.update(Uint8Array.from([0x61, 0x62, 0x63, 0x64, 0x65]));
        x.update(Uint8Array.from([0x61, 0x62, 0x63, 0x64, 0x65]));
        x.update(Uint8Array.from([0x61, 0x62, 0x63, 0x64, 0x65]));
        x.update(Uint8Array.from([0x61, 0x62, 0x63, 0x64, 0x65]));
        expect(x.final()).to.equal(0xE64CB665);
    });
    it("can digest large chunks at once", () => {
        var x = new XXH32();
        x.update(Uint8Array.from([0x61, 0x62, 0x63, 0x64, 0x65,
                                  0x61, 0x62, 0x63, 0x64, 0x65,
                                  0x61, 0x62, 0x63, 0x64, 0x65,
                                  0x61, 0x62, 0x63, 0x64, 0x65]));
        expect(x.final()).to.equal(0xE64CB665);
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
