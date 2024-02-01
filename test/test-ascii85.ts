import "mocha";
import { expect } from "chai";
import * as A85 from "../lib/ascii85.js";

function strToOctets(str: string): Uint8Array {
    return Uint8Array.from(
        Array.from(str).map(char => char.charCodeAt(0)));
}

function octetsToStr(u8: Uint8Array): string {
    return String.fromCodePoint(...u8);
}

describe("Ascii85", () => {
    it("encodes a known input correctly and it also roundtrips", () => {
        const src =
            "Man is distinguished, not only by his reason, but by this "    +
            "singular passion from other animals, which is a lust of the "  +
            "mind, that by a perseverance of delight in the continued and " +
            "indefatigable generation of knowledge, exceeds the short "     +
            "vehemence of any carnal pleasure.";
        const a85 =
            "9jqo^BlbD-BleB1DJ+*+F(f,q/0JhKF<GL>Cj@.4Gp$d7F!,L7@<6@)/0JDEF<G%<+EV:2F!,O<" +
            "DJ+*.@<*K0@<6L(Df-\\0Ec5e;DffZ(EZee.Bl.9pF\"AGXBPCsi+DGm>@3BB/F*&OCAfu2/AKYi(" +
            "DIb:@FD,*)+C]U=@3BN#EcYf8ATD3s@q?d$AftVqCh[NqF<G:8+EV:.+Cf>-FD5W8ARlolDIal(" +
            "DId<j@<?3r@:F%a+D58'ATD4$Bl@l3De:,-DJs`8ARoFb/0JMK@qB4^F!,R<AKZ&-DfTqBG%G>u" +
            "D.RTpAKYo'+CT/5+Cei#DII?(E,9)oF*2M7/c";

        expect(A85.encode(strToOctets(src))).to.equal(a85);
        expect(octetsToStr(A85.decode(a85))).to.equal(src);
    });
});
