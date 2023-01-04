import * as Fmt from "../fmt-code.js";
import { Tag, Doc } from "./primitives.js";

/** Display a document with black forecolour. */
export function black(d: Doc): Doc {
    return colour(Fmt.Colour.Black, d);
}

/** Display a document with dark blue forecolour. */
export function darkBlue(d: Doc): Doc {
    return colour(Fmt.Colour.DarkBlue, d);
}

/** Display a document with dark green forecolour. */
export function darkGreen(d: Doc): Doc {
    return colour(Fmt.Colour.DarkGreen, d);
}

/** Display a document with dark aqua forecolour. */
export function darkAqua(d: Doc): Doc {
    return colour(Fmt.Colour.DarkAqua, d);
}

/** Display a document with dark red forecolour. */
export function darkRed(d: Doc): Doc {
    return colour(Fmt.Colour.DarkRed, d);
}

/** Display a document with dark purple forecolour. */
export function darkPurple(d: Doc): Doc {
    return colour(Fmt.Colour.DarkPurple, d);
}

/** Display a document with gold forecolour. */
export function gold(d: Doc): Doc {
    return colour(Fmt.Colour.Gold, d);
}

/** Display a document with gray forecolour. */
export function gray(d: Doc): Doc {
    return colour(Fmt.Colour.Gray, d);
}

/** Display a document with dark gray forecolour. */
export function darkGray(d: Doc): Doc {
    return colour(Fmt.Colour.DarkGray, d);
}

/** Display a document with blue forecolour. */
export function blue(d: Doc): Doc {
    return colour(Fmt.Colour.Blue, d);
}

/** Display a document with green forecolour. */
export function green(d: Doc): Doc {
    return colour(Fmt.Colour.Green, d);
}

/** Display a document with aqua forecolour. */
export function aqua(d: Doc): Doc {
    return colour(Fmt.Colour.Aqua, d);
}

/** Display a document with red forecolour. */
export function red(d: Doc): Doc {
    return colour(Fmt.Colour.Red, d);
}

/** Display a document with light purple forecolour. */
export function lightPurple(d: Doc): Doc {
    return colour(Fmt.Colour.LightPurple, d);
}

/** Display a document with yellow forecolour. */
export function yellow(d: Doc): Doc {
    return colour(Fmt.Colour.Yellow, d);
}

/** Display a document with white forecolour. */
export function white(d: Doc): Doc {
    return colour(Fmt.Colour.White, d);
}

/** Display a document with Minecoin gold forecolour. */
export function minecoinGold(d: Doc): Doc {
    return colour(Fmt.Colour.MinecoinGold, d);
}

/** Display a document with a forecolour given in the first parameter. */
export function colour(c: Fmt.Colour, d: Doc): Doc {
    return {
        tag:    Tag.Colour,
        colour: c,
        doc:    d
    };
}
