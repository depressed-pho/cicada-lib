import * as Fmt from "../fmt-code.js";

export enum Tag {
    Fail,
    Empty,
    Text,
    Line,
    FlatAlt,
    Cat,
    Nest,
    Union,
    Column,
    Columns,
    Nesting,
    Colour,
    Obfuscate,
    Bold,
    Italicise,
    RestoreFormat
}

interface Fail {
    tag: Tag.Fail
}
interface Empty {
    tag: Tag.Empty
}
interface Text {
    tag:  Tag.Text,
    text: string // Always non-empty
}
interface Line {
    tag: Tag.Line
}
interface FlatAlt {
    tag: Tag.FlatAlt,
    fst: Doc,
    snd: Doc
}
interface Cat {
    tag: Tag.Cat,
    fst: Doc,
    snd: Doc
}
interface Nest {
    tag:   Tag.Nest,
    level: number,
    doc:   Doc
}
/** invariant: the first line of the first doc is longer than the first
 * line of the second doc. */
interface Union {
    tag: Tag.Union,
    fst: Doc,
    snd: Doc
}
interface Column {
    tag: Tag.Column,
    f:   (n: number) => Doc
}
interface Columns {
    tag: Tag.Columns,
    f:   (n: number|null) => Doc
}
interface Nesting {
    tag: Tag.Nesting,
    f:   (n: number) => Doc
}
interface Colour {
    tag:    Tag.Colour,
    colour: Fmt.Colour,
    doc:    Doc
}
interface Obfuscate {
    tag:     Tag.Obfuscate,
    enabled: boolean,
    doc:     Doc
}
interface Bold {
    tag:     Tag.Bold,
    enabled: boolean,
    doc:     Doc
}
interface Italicise {
    tag:     Tag.Italicise,
    enabled: boolean,
    doc:     Doc
}
/** Only used during the rendered phase, to signal a formatting code should
 * be issued to restore the text formatting. */
export interface RestoreFormat {
    tag:           Tag.RestoreFormat,
    colour:        Fmt.Colour|null,
    obfuscate:     boolean,
    bold:          boolean,
    italicise:     boolean
}

/** The abstract data type `Doc` represents pretty documents.
 *
 * More specifically, a value of type `Doc` represents a non-empty set of
 * possible renderings of a document. The rendering functions select one of
 * these possibilities.
 */
export type Doc = Fail | Empty | Text | Line | FlatAlt | Cat | Nest | Union |
    Column | Columns | Nesting | Colour | Obfuscate | Bold | Italicise |
    RestoreFormat;

export enum STag {
    SFail,
    SEmpty,
    SText,
    SLine,
    SFormat
}

interface SFail {
    tag: STag.SFail
}
interface SEmpty {
    tag: STag.SEmpty
}
interface SText {
    tag:  STag.SText,
    text: string,
    succ: SimpleDoc
}
interface SLine {
    tag:     STag.SLine,
    indent:  number, // The indentation for this line.
    content: SimpleDoc
}
interface SFormat {
    tag:     STag.SFormat,
    codes:   Fmt.Code[],
    content: SimpleDoc
}

/** The data type `SimpleDoc` represents rendered documents and is used by
* the display functions.
*
* Whereas values of the data type {@link Doc} represent non-empty sets of
* possible renderings of a document, values of the data type `SimpleDoc`
* represent single renderings of a document.
*
* The library provides two default display functions {@link displayS} and
* {link displayIO}. You can provide your own display function by writing a
* function from a `SimpleDoc` to your own output format.
*/
export type SimpleDoc = SFail | SEmpty | SText | SLine | SFormat;

export const sFail: SimpleDoc = {
    tag: STag.SFail
};

export const sEmpty: SimpleDoc = {
    tag: STag.SEmpty
};

export function sText(text: string, succ: SimpleDoc): SimpleDoc {
    return {
        tag: STag.SText,
        text,
        succ
    };
}

export function sLine(indent: number, content: SimpleDoc): SimpleDoc {
    return {
        tag: STag.SLine,
        indent,
        content
    };
}

export function sFormat(codes: Fmt.Code[], content: SimpleDoc): SimpleDoc {
    return {
        tag: STag.SFormat,
        codes,
        content
    };
}

/** The empty document is, indeed, empty. Although `empty` has no
 * content, it does have a "height" of 1 and behaves exactly like
 * `text("")` (and is therefore not a unit of {@link lineCat}).
 */
export const empty: Doc = {
    tag: Tag.Empty
};

/** The document `text(s)` contains the literal string `s`. The string
 * shouldn't contain any newline (`"\n"`) characters. If the string
 * contains newline characters, the function {@link string} should be used.
 */
export function text(s: string): Doc {
    return s.length == 0
        ? {tag: Tag.Empty}
        : {tag: Tag.Text, text: s};
}

/** The document `space` contains a single space, `" "`.
 */
export const space: Doc = {
    tag:  Tag.Text,
    text: " "
};

/** A linebreak that will never be flattened; it is guaranteed to render as
 * a newline.
 */
export const hardline: Doc = {
    tag: Tag.Line
};

/** The `line` document advances to the next line and indents to the
 * current nesting level. Document `line` behaves like `text(" ")`
 * if the line break is undone by {@link group}.
 */
export const line: Doc = flatAlt(hardline, space);

/** The `linebreak` document advances to the next line and indents to
 * the current nesting level. Document `linebreak` behaves like
 * {@link empty} if the line break is undone by {@ group}.
 */
export const linebreak: Doc = flatAlt(hardline, empty);

/** The document `beside(x, y)` concatenates document `x` and document
 * `y`. It is an associative operation having {@link empty} as a left and right
 * unit.
 */
export function beside(x: Doc, y: Doc): Doc {
    return {
        tag: Tag.Cat,
        fst: x,
        snd: y
    };
}

/** The document `nest(i, x)` renders document `x` with the current
 * indentation level increased by `i` (See also {@link hang}, {@link
 * align}, and {@link indent}).
 *
 * ``javascript
 * lineCat(nest(2, lineCat(text("hello"), text("world"))), text("!"))
 * ``
 *
 * outputs as:
 *
 * ``
 * hello
 *   world
 * !
 * ``
 */
export function nest(i: number, x: Doc): Doc {
    return {
        tag:   Tag.Nest,
        level: i,
        doc:   x
    };
}

/** `column(f)` creates a document by applying the current column to the
 * given function `f`.
 */
export function column(f: (n: number) => Doc): Doc {
    return {
        tag: Tag.Column,
        f:   f
    };
}

/** `columns(f)` creates a document by applying the page width to the given
 * function `f`. If the document is being rendered without a finite page
 * width, a ``null`` value will be applied.
 */
export function columns(f: (n: number|null) => Doc): Doc {
    return {
        tag: Tag.Columns,
        f:   f
    };
}

/** `nesting(f)` creates a document by applying the current nesting level
 * (i.e. indentation level) to the given function `f`.
 */
export function nesting(f: (n: number) => Doc): Doc {
    return {
        tag: Tag.Nesting,
        f:   f
    };
}

/** A document that is normally rendered as the first argument, but when
 * flattened, is rendered as the second document.
 */
export function flatAlt(x: Doc, y: Doc): Doc {
    return {
        tag: Tag.FlatAlt,
        fst: x,
        snd: y
    };
}

export const fail: Doc = {
    tag: Tag.Fail
};

export function union(x: Doc, y: Doc): Doc {
    return {
        tag: Tag.Union,
        fst: x,
        snd: y
    };
}
