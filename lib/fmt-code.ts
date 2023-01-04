export enum Colour {
    Black        = "0",
    DarkBlue     = "1",
    DarkGreen    = "2",
    DarkAqua     = "3",
    DarkRed      = "4",
    DarkPurple   = "5",
    Gold         = "6",
    Gray         = "7",
    DarkGray     = "8",
    Blue         = "9",
    Green        = "a",
    Aqua         = "b",
    Red          = "c",
    LightPurple  = "d",
    Yellow       = "e",
    White        = "f",
    MinecoinGold = "g"
}

enum FmtTag {
    Reset,
    SetColour,
    Obfuscate,
    Bold,
    Strikethrough,
    Underline,
    Italicise
}

interface Reset {
    tag: FmtTag.Reset
}
interface SetColour {
    tag:    FmtTag.SetColour,
    colour: Colour
}
interface Obfuscate {
    tag: FmtTag.Obfuscate
}
interface Bold {
    tag: FmtTag.Bold
}
interface Strikethrough {
    tag: FmtTag.Strikethrough
}
interface Underline {
    tag: FmtTag.Underline
}
interface Italicise {
    tag: FmtTag.Italicise
}

export type Code = Reset | SetColour | Obfuscate | Bold |
    Strikethrough | Underline | Italicise;

export const reset: Code = {
    tag: FmtTag.Reset
};

export function setColour(c: Colour): Code {
    return {
        tag:    FmtTag.SetColour,
        colour: c
    };
}

export const obfuscate: Code = {
    tag: FmtTag.Obfuscate
}

export const bold: Code = {
    tag: FmtTag.Bold
}

export const strikethrough: Code = {
    tag: FmtTag.Strikethrough
}

export const underline: Code = {
    tag: FmtTag.Underline
}

export const italicise: Code = {
    tag: FmtTag.Italicise
}

export function toString(codes: Code[]): string {
    return codes.map(c => {
        switch (c.tag) {
            case FmtTag.Reset:         return "§r";
            case FmtTag.SetColour:     return "§" + c.colour;
            case FmtTag.Obfuscate:     return "§k";
            case FmtTag.Bold:          return "§l";
            case FmtTag.Strikethrough: return "§m";
            case FmtTag.Underline:     return "§n";
            case FmtTag.Italicise:     return "§o";
        }
    }).join("");
}
