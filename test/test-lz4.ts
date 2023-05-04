import "mocha";
import { expect } from "chai";
import * as LZ4 from "../lib/lz4.js";

function strToOctets(str: string): Uint8Array {
    return Uint8Array.from(
        Array.from(str).map(char => char.charCodeAt(0)));
}

function octetsToStr(u8: Uint8Array): string {
    return String.fromCodePoint(...u8);
}

describe("class LZ4Compressor", () => {
    it("can process a zero-length input without dying", () => {
        const lz4 = new LZ4.LZ4Compressor();
        lz4.final();
    });
    it("can process a zero-length block without dying", () => {
        const lz4 = new LZ4.LZ4Compressor();
        lz4.update(strToOctets(""));
    });
    it("can process a non-compressible input", () => {
        const lz4 = new LZ4.LZ4Compressor();
        lz4.update(strToOctets("abcdefg"));
    });
    it("can process a compressible input", () => {
        const lz4       = new LZ4.LZ4Compressor();
        lz4.update(strToOctets("")); // Discard the frame header.
        const blockRaw  = strToOctets("abcdefghijklmnopqrst_bcdefghijklmnop*****");
        const blockComp = lz4.update(blockRaw);

        // But is it actually shorter than the source?
        expect(blockComp.byteLength).to.be.below(blockRaw.byteLength);
    });
    it("can make use of previous blocks", () => {
        const lz4       = new LZ4.LZ4Compressor();
        lz4.update(strToOctets("abcdefghijklmnop"));
        const blockRaw  = strToOctets("qr_abcdefghijklmnopqrs*****");
        const blockComp = lz4.update(blockRaw);

        // But is it actually shorter than the source?
        expect(blockComp.byteLength).to.be.below(blockRaw.byteLength);
    });
    it("can compress highly redundant input well", () => {
        const lz4       = new LZ4.LZ4Compressor();
        lz4.update(strToOctets("")); // Discard the frame header.
        const blockRaw  = strToOctets("ababababababababababababababababababababab");
        const blockComp = lz4.update(blockRaw);

        expect(blockComp.byteLength).to.be.below(blockRaw.byteLength / 2);
    });
});

describe("LZ4.decompress()", () => {
    it("can decompress known good LZ4 data", () => {
        // Produced using the reference compressor.
        const lz4 = Uint8Array.from(
            [ 0x04, 0x22, 0x4D, 0x18, 0x64, 0x40, 0xA7, 0x1F,
              0x00, 0x00, 0x00, 0xFB, 0x06, 0x61, 0x62, 0x63,
              0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x6B,
              0x6C, 0x6D, 0x6E, 0x6F, 0x70, 0x71, 0x72, 0x73,
              0x74, 0x5F, 0x14, 0x00, 0x50, 0x2A, 0x2A, 0x2A,
              0x2A, 0x2A, 0x00, 0x00, 0x00, 0x00, 0x3A, 0x77,
              0xB6, 0xCC
            ]);
        const raw = LZ4.decompress(lz4);
        expect(octetsToStr(raw)).to.equal("abcdefghijklmnopqrst_bcdefghijklmnop*****");
    });
});
