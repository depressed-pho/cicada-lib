import { Doc, beside, column, empty, text, space, line, linebreak, nest,
         nesting } from "./primitives.js";
import { group } from "./flatten.js";

/** The document `sep(ds)` concatenates all documents `ds` either
 * horizontally with {@link spaceCat} if it fits the page, or vertically
 * with {@link lineCat}.
 */
export function sep(ds: Doc[]): Doc {
    return group(vsep(ds));
}

/** The document `fillSep(ds)` concatenates documents `ds` horizontally
 * with {@link spaceCat} as long as its fits the page, then inserts a
 * {@link line} and continues doing that for all documents in `ds`.
 */
export function fillSep(ds: Doc[]): Doc {
    return fold(softlineCat, ds);
}

/** The document `hsep(ds)` concatenates all documents `ds` horizontally
 * with {@link spaceCat}.
 */
export function hsep(ds: Doc[]): Doc {
    return fold(spaceCat, ds);
}


/** The document `vsep(ds)` concatenates all documents `ds` vertically with
 * {@link lineCat}. If a {@link group} undoes the line breaks inserted by
 * `vsep`, all documents are separated with a space.
 *
 * ``javascript
 * const someText = ["text", "to", "lay", "out"].map(text);
 * const test     = spaceCat(text("some"), vsep(someText));
 * ``
 *
 * This is layed out as:
 *
 * ``
 * some text
 * to
 * lay
 * out
 * ``
 *
 * The {@link align} combinator can be used to align the documents under
 * their first element
 *
 * ``javascript
 * const test = spaceCat(text("some"), align(vsep(someText)));
 * ``
 *
 * Which is printed as:
 *
 * ``
 * some text
 *      to
 *      lay
 *      out
 * ``
 */
export function vsep(ds: Doc[]): Doc {
    return fold(lineCat, ds);
}

/** The document `cat(ds)` concatenates all documents `ds` either
 * horizontally with {@link beside} if it fits the page, or vertically with
 * {@link linebreakCat}.
 */
export function cat(ds: Doc[]): Doc {
    return group(vcat(ds));
}

/** The document `fillCat(ds)` concatenates documents `ds` horizontally
 * with {@link beside} as long as its fits the page, then inserts a {@link
 * linebreak} and continues doing that for all documents in `ds`.
 */
export function fillCat(ds: Doc[]): Doc {
    return fold(softbreakCat, ds);
}

/** The document `hcat(ds)` concatenates all documents `ds` horizontally
 * with {@link beside}.
 */
export function hcat(ds: Doc[]): Doc {
    return fold(beside, ds);
}

/** The document `vcat(ds)` concatenates all documents `ds` vertically with
 * {@link linebreakCat}. If a {@link group} undoes the line breaks inserted
 * by `vcat`, all documents are directly concatenated.
 */
export function vcat(ds: Doc[]): Doc {
    return fold(linebreakCat, ds);
}

/** Fold an array of documents with a given binary operator. If the array
 * is empty, the resulting document will also be {@link empty}.
 */
export function fold(f: (x: Doc, y: Doc) => Doc, ds: Doc[]): Doc {
    return ds.length == 0
        ? empty
        : ds.reduce(f);
}

/** The document `softline` behaves like {@link space} if the resulting
 * output fits the page, otherwise it behaves like {@link line}.
 */
export const softline: Doc = group(line);

/** The document `softbreak` behaves like {@link empty} if the resulting
 * output fits the page, otherwise it behaves like {@link line}.
 */
export const softbreak: Doc = group(linebreak);

/** The document `lparen` contains a left parenthesis `(`.
 */
export const lparen: Doc = text("(");

/** The document `lparen` contains a right parenthesis `)`.
 */
export const rparen: Doc = text(")");

/** The document `langle` contains a left angle bracket `<`.
 */
export const langle: Doc = text("<");

/** The document `rangle` contains a right angle bracket `>`.
 */
export const rangle: Doc = text(">");

/** The document `lbrace` contains a left brace `{`.
 */
export const lbrace: Doc = text("{");

/** The document `rbrace` contains a right brace `}`.
 */
export const rbrace: Doc = text("}");

/** The document `lbracket` contains a left square bracket `[`.
 */
export const lbracket: Doc = text("[");

/** The document `rbracket` contains a right square bracket `]`.
 */
export const rbracket: Doc = text("]");

/** The document `squote` contains a single quote `'`.
 */
export const squote: Doc = text("'");

/** The document `dquote` contains a double quote `"`.
 */
export const dquote: Doc = text('"');

/** The document `semi` contains a semicolon `;`.
 */
export const semi: Doc = text(";");

/** The document `colon` contains a colon `:`.
 */
export const colon: Doc = text(":");

/** The document `colon` contains a comma `,`.
 */
export const comma: Doc = text(",");

/** The document `colon` contains a single dot `.`.
 */
export const dot: Doc = text(".");

/** The document `backslash` contains a back slash `\`.
 */
export const backslash: Doc = text("\\");

/** The document `equals` contains an equal sign `=`.
 */
export const equals: Doc = text("=");

/** The document `spaceCat(x, y)` concatenates document `x` and `y` with a
 * {@link space} in between.
 */
export function spaceCat(x: Doc, y: Doc): Doc {
    return beside(beside(x, space), y);
}

/** The document `softlineCat(x, y)` concatenates document `x` and `y` with
 * a {@link softline} in between. This effectively puts `x` and `y` either
 * next to each other (with a {@link space} in between) or underneath each
 * other.
 */
export function softlineCat(x: Doc, y: Doc): Doc {
    return beside(beside(x, softline), y);
}

/** The document `softbreakCat(x, y)` concatenates document `x` and `y`
 * with a {@link softbreak} in between. This effectively puts `x` and `y`
 * either right next to each other or underneath each other.
 */
export function softbreakCat(x: Doc, y: Doc): Doc {
    return beside(beside(x, softbreak), y);
}

/** The document `lineCat(x, y)` concatenates document `x` and `y` with a
 * {@link line} in between.
 */
export function lineCat(x: Doc, y: Doc): Doc {
    return beside(beside(x, line), y);
}

/** The document `linebreakCat(x, y)` concatenates document `x` and `y`
 * with a {@link linebreak} in between.
 */
export function linebreakCat(x: Doc, y: Doc): Doc {
    return beside(beside(x, linebreak), y);
}

/** Document `squotes(d)` encloses document `d` with single quotes `'`.
 */
export function squotes(d: Doc): Doc {
    return enclose(squote, squote, d);
}

/** Document `dquotes(d)` encloses document `d` with double quotes `"`.
 */
export function dquotes(d: Doc): Doc {
    return enclose(dquote, dquote, d);
}

/** Document `braces(d)` encloses document `d` in braces `{` and `}`.
 */
export function braces(d: Doc): Doc {
    return enclose(lbrace, rbrace, d);
}

/** Document `parens(d)` encloses document `d` in parentheses `(` and `)`.
 */
export function parens(d: Doc): Doc {
    return enclose(lparen, rparen, d);
}

/** Document `angles(d)` encloses document `d` in angle brackets `<` and
 * `>`.
 */
export function angles(d: Doc): Doc {
    return enclose(langle, rangle, d);
}

/** Document `brackets(d)` encloses document `d` in square brackets `[` and
 * `]`.
 */
export function brackets(d: Doc): Doc {
    return enclose(lbracket, rbracket, d);
}

/** The document `enclose(l, r, d)` encloses document `d` between documents
 * `l` and `r` using {@link beside}.
 */
export function enclose(l: Doc, r: Doc, d: Doc): Doc {
    return beside(beside(l, d), r);
}

/** The document `string(s)` concatenates all characters in `s` using
 * {@link line} for newline characters and {@link text} for all other
 * characters. It is used instead of {@link text} whenever the text
 * contains newline characters.
 */
export function string(s: string): Doc {
    const ds = [];
    let begin = 0;
    while (true) {
        const pos = s.indexOf("\n", begin);
        if (pos == -1) {
            ds.push(text(s.slice(begin)));
            break;
        }
        else {
            ds.push(text(s.slice(begin, pos)), line);
            begin = pos + 1;
        }
    }
    return hcat(ds);
}

/** The document `bool(b)` shows the literal boolean `b` using {@link
 * text}.
 */
export function bool(b: boolean): Doc {
    return text(String(b));
}

/** The document `number(n)` shows the literal number `n` using {@link
 * text}.
 */
export function number(n: number): Doc {
    return text(String(n));
}

export function spaces(n: number): string {
    return n <= 0 ? "" : " ".repeat(n);
}

/** The document `fill(i, d)` renders document `d`. It then appends {@link
 * space}s until the width is equal to `i`. If the width of `d` is already
 * larger, nothing is appended. This combinator is quite useful in practice
 * to output a list of bindings. The following example demonstrates this.
 *
 * ``javascript
 * const types = [ ["empty", "Doc"],
 *                 ["nest", "Int -> Doc -> Doc"],
 *                 ["linebreak", "Doc"] ];
 * function ptype([name, tp]: [string, string]): Doc {
 *     return spaceCat(spaceCat(fill(6, text(name)), text("::")), text(tp));
 * }
 * const test = spaceCat(text("let"), align(vcat(types.map(ptype))));
 * ``
 *
 * Which is layed out as:
 *
 * ``
 * let empty  :: Doc
 *     nest   :: Int -> Doc -> Doc
 *     linebreak :: Doc
 * ``
 */
export function fill(i: number, d: Doc): Doc {
    return width(d, w => {
        if (w >= i) {
            return empty;
        }
        else {
            return text(spaces(i - w));
        }
    });
}

/** The document `fillBreak(i, d)` first renders document `d`. It then
 * appends {@link space}s until the width is equal to `i`. If the width of
 * `d` is already larger than `i`, the nesting level is increased by `i`
 * and a {@link line} is appended. When we redefine `ptype` in the previous
 * example to use `fillBreak`, we get a useful variation of the previous
 * output:
 *
 * ``javascript
 * function ptype([name, tp]: [string, string]) {
 *     return spaceCat(spaceCat(fillBreak(6, text(name)), text("::")), text(tp));
 * }
 * ``
 *
 * The output will now be:
 *
 * ``
 * let empty  :: Doc
 *     nest   :: Int -> Doc -> Doc
 *     linebreak
 *            :: Doc
 * ``
 */
export function fillBreak(i: number, d: Doc): Doc {
    return width(d, w => {
        if (w > i) {
            return nest(i, linebreak);
        }
        else {
            return text(spaces(i - w));
        }
    });
}

function width(d: Doc, f: (i: number) => Doc): Doc {
    return column(k1 => beside(d, column(k2 => f(k2 - k1))));
}

/** The document `indent(i, d)` indents document `d` with `i` spaces.
 *
 * ``javascript
 * const test = indent(
 *                4,
 *                fillSep("indent combinator indents these words !"
 *                          .split(" ")
 *                          .map(text)));
 * ``
 *
 * Which lays out with a page width of 20 as:
 *
 * ``
 *     the indent
 *     combinator
 *     indents these
 *     words !
 * ``
 */
export function indent(i: number, d: Doc): Doc {
    return hang(i, beside(text(spaces(i)), d));
}

/** The hang combinator implements hanging indentation. The document
 * `hang(i, d)` renders document `d` with a nesting level set to the
 * current column plus `i`. The following example uses hanging indentation
 * for some text:
 *
 * ``javascript
 * const test = hang(
 *                4,
 *                fillSep("the hang combinator indents these words !"
 *                          .split(" ")
 *                          .map(text)));
 * ``
 *
 * Which lays out on a page with a width of 20 characters as:
 *
 * ``
 * the hang combinator
 *     indents these
 *     words !
 * ``
 */
export function hang(i: number, d: Doc): Doc {
    return align(nest(i, d));
}

/** The document `align(d)` renders document `d` with the nesting level set
 * to the current column. It is used for example to implement {@link hang}.
 *
 * As an example, we will put a document right above another one,
 * regardless of the current nesting level:
 *
 * ``javascript
 * function paste(x: Doc, y: Doc): Doc {
 *     return align(lineCat(x, y));
 * }
 * const test = textCat(text("hi"), paste(text("nice"), text("world"));
 * ``
 *
 * which will be layed out as:
 *
 * ``
 * hi nice
 *    world
 * ``
 */
export function align(d: Doc): Doc {
    return column(k => nesting(i => nest(k - i, d)));
}
