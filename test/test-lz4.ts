import "mocha";
import { expect } from "chai";
import { LZ4Compressor } from "../lib/lz4.js";

function strToOctets(str: string): Uint8Array {
    return Uint8Array.from(
        Array.from(str).map(char => char.charCodeAt(0)));
}

describe("class LZ4Compressor", () => {
    it("can process a zero-length input without dying", () => {
        const lz4 = new LZ4Compressor();
        lz4.final();
    });
    it("can process a zero-length block without dying", () => {
        const lz4 = new LZ4Compressor();
        lz4.update(strToOctets(""));
    });
    it("can process a non-compressible input", () => {
        const lz4 = new LZ4Compressor();
        lz4.update(strToOctets("abcdefg"));
    });
    it("can process a compressible input", () => {
        const lz4       = new LZ4Compressor();
        lz4.update(strToOctets("")); // Discard the frame header.
        const blockRaw  = strToOctets("abcdefghijklmnopqrst_bcdefghijklmnop*****");
        const blockComp = lz4.update(blockRaw);

        // But is it actually shorter than the source?
        expect(blockComp.byteLength).to.be.below(blockRaw.byteLength);
    });
    it("can make use of previous blocks", () => {
        const lz4       = new LZ4Compressor();
        lz4.update(strToOctets("abcdefghijklmnop"));
        const blockRaw  = strToOctets("qr_abcdefghijklmnopqrs*****");
        const blockComp = lz4.update(blockRaw);

        // But is it actually shorter than the source?
        expect(blockComp.byteLength).to.be.below(blockRaw.byteLength);
    });
    it("can compress highly redundant input well", () => {
        const lz4       = new LZ4Compressor();
        lz4.update(strToOctets("")); // Discard the frame header.
        const blockRaw  = strToOctets("ababababababababababababababababababababab");
        const blockComp = lz4.update(blockRaw);

        expect(blockComp.byteLength).to.be.below(blockRaw.byteLength / 2);
    });
});
