/// See https://learn.microsoft.com/en-us/minecraft/creator/reference/content/rawmessagejson?view=minecraft-bedrock-experimental#formatting-codes-
export enum Colour {
    Black         = "0",
    DarkBlue      = "1",
    DarkGreen     = "2",
    DarkAqua      = "3",
    DarkRed       = "4",
    DarkPurple    = "5",
    Orange        = "6",
    Gray          = "7",
    DarkGray      = "8",
    Blue          = "9",
    Green         = "a",
    LightBlue     = "b",
    Red           = "c",
    Pink          = "d",
    Yellow        = "e",
    White         = "f",
    Gold          = "g",
    WarmLightGray = "h",
    CoolLightGray = "i",
    DarkBrown     = "j",
    DarkerRed     = "m", // Officially called "dark red" but the name conflicts with §4.
    Brown         = "n",
    DarkGold      = "p", // Officially called "gold" but the name conflicts with §g.
    Aqua          = "s",
    DarkTeal      = "t",
    Purple        = "u"
}

enum FmtTag {
    Reset,
    SetColour,
    Obfuscate,
    Bold,
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
interface Italicise {
    tag: FmtTag.Italicise
}

export type Code = Reset | SetColour | Obfuscate | Bold | Italicise;

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
            case FmtTag.Italicise:     return "§o";
        }
    }).join("");
}
