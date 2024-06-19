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

/** Display a document with orange forecolour. */
export function orange(d: Doc): Doc {
    return colour(Fmt.Colour.Orange, d);
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

/** Display a document with light blue forecolour. */
export function lightBlue(d: Doc): Doc {
    return colour(Fmt.Colour.LightBlue, d);
}

/** Display a document with red forecolour. */
export function red(d: Doc): Doc {
    return colour(Fmt.Colour.Red, d);
}

/** Display a document with pink forecolour. */
export function pink(d: Doc): Doc {
    return colour(Fmt.Colour.Pink, d);
}

/** Display a document with yellow forecolour. */
export function yellow(d: Doc): Doc {
    return colour(Fmt.Colour.Yellow, d);
}

/** Display a document with white forecolour. */
export function white(d: Doc): Doc {
    return colour(Fmt.Colour.White, d);
}

/** Display a document with gold forecolour. */
export function gold(d: Doc): Doc {
    return colour(Fmt.Colour.Gold, d);
}

/** Display a document with warm light gray forecolour. */
export function warmLightGray(d: Doc): Doc {
    return colour(Fmt.Colour.WarmLightGray, d);
}

/** Display a document with cool light gray forecolour. */
export function coolLightGray(d: Doc): Doc {
    return colour(Fmt.Colour.CoolLightGray, d);
}

/** Display a document with dark brown forecolour. */
export function darkBrown(d: Doc): Doc {
    return colour(Fmt.Colour.DarkBrown, d);
}

/** Display a document with darker red forecolour. */
export function darkerRed(d: Doc): Doc {
    return colour(Fmt.Colour.DarkerRed, d);
}

/** Display a document with brown forecolour. */
export function brown(d: Doc): Doc {
    return colour(Fmt.Colour.Brown, d);
}

/** Display a document with dark gold forecolour. */
export function darkGold(d: Doc): Doc {
    return colour(Fmt.Colour.DarkGold, d);
}

/** Display a document with aqua forecolour. */
export function aqua(d: Doc): Doc {
    return colour(Fmt.Colour.Aqua, d);
}

/** Display a document with dark teal forecolour. */
export function darkTeal(d: Doc): Doc {
    return colour(Fmt.Colour.DarkTeal, d);
}

/** Display a document with purple forecolour. */
export function purple(d: Doc): Doc {
    return colour(Fmt.Colour.Purple, d);
}

/** Display a document with a forecolour given in the first parameter. */
export function colour(c: Fmt.Colour, d: Doc): Doc {
    return {
        tag:    Tag.Colour,
        colour: c,
        doc:    d
    };
}
