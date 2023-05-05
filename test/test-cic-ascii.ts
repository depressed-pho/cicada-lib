import "mocha";
import { expect } from "chai";
import * as CicASCII from "../lib/cic-ascii.js";

function strToOctets(str: string): Uint8Array {
    return Uint8Array.from(
        Array.from(str).map(char => char.charCodeAt(0)));
}

function octetsToStr(u8: Uint8Array): string {
    return String.fromCodePoint(...u8);
}

describe("CicASCII", () => {
    it("non-compressible payload roundtrips", () => {
        const src = "(((abcdefghijklmnopqrstuvwxyz)))"
        const ca  = CicASCII.encode(strToOctets(src));

        expect(octetsToStr(CicASCII.decode(ca))).to.equal(src);
    });
    it("compressible payload roundtrips", () => {
        const src = "(((abababababababababababababababababababababababab)))"
        const ca  = CicASCII.encode(strToOctets(src));

        expect(octetsToStr(CicASCII.decode(ca))).to.equal(src);
    });
});
