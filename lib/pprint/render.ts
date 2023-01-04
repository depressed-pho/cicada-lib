import { lazy } from "../lazy.js";
import { Doc, SimpleDoc, STag, Tag, RestoreFormat, beside, empty, flatAlt,
         nest, union, column, columns, nesting, sFail, sEmpty, sText, sLine,
         sFormat } from "./primitives.js";
import { spaces } from "./combinators.js";
import * as Fmt from "../fmt-code.js";

// Most JS interpreters don't eliminate tail-calls. Even V8 doesn't. We
// have to manually do it, or this module becomes a source of frequent
// stack overflows. We also do lazy evaluation extensively so that
// non-tail-calls don't overflow the stack.

/** Remove all colorisation and any other stylings from a document.
 */
export function plain(doc: Doc): Doc {
    plain: while (true) {
        const d = doc;
        switch (d.tag) {
            case Tag.Fail:          return d;
            case Tag.Empty:         return d;
            case Tag.Text:          return d;
            case Tag.Line:          return d;
            case Tag.FlatAlt:       return flatAlt(lazy(() => plain(d.fst)),
                                                   lazy(() => plain(d.snd)));
            case Tag.Cat:           return beside(lazy(() => plain(d.fst)),
                                                  lazy(() => plain(d.snd)));
            case Tag.Nest:          return nest(d.level, lazy(() => plain(d.doc)));
            case Tag.Line:          return d;
            case Tag.Union:         return union(lazy(() => plain(d.fst)),
                                                 lazy(() => plain(d.snd)));
            case Tag.Column:        return column(n => plain(d.f(n)));
            case Tag.Columns:       return columns(n => plain(d.f(n)));
            case Tag.Nesting:       return nesting(n => plain(d.f(n)));
            case Tag.Colour:        doc = d.doc; continue plain;
            case Tag.Obfuscate:     doc = d.doc; continue plain;
            case Tag.Bold:          doc = d.doc; continue plain;
            case Tag.Strikethrough: doc = d.doc; continue plain;
            case Tag.Underline:     doc = d.doc; continue plain;
            case Tag.Italicise:     doc = d.doc; continue plain;
            case Tag.RestoreFormat: return empty;
        }
    }
}

enum DocsTag {
    DNil,
    DCons
}
interface DNil {
    tag: DocsTag.DNil
}
interface DCons {
    tag:    DocsTag.DCons
    indent: number,
    doc:    Doc,
    docs:   Docs
}
/** List of indentation/document pairs; saves an indirection over [[number,
 * Doc)].
 */
type Docs = DNil | DCons;

const dNil: Docs = {
    tag: DocsTag.DNil
};

function dCons(indent: number, doc: Doc, docs: Docs): Docs {
    return {
        tag: DocsTag.DCons,
        indent,
        doc,
        docs
    };
}

/** This is the default pretty printer. `renderPretty(ribbonFrac, width, d)`
 * renders document `d` with a page width of `width` and a ribbon width
 * of `ribbonFrac * width` characters. The ribbon width is the maximal
 * amount of non-indentation characters on a line. The parameter
 * `ribbonFrac` should be between `0.0` and `1.0`. If it is lower or
 * higher, the ribbon width will be 0 or `width` respectively.
 */
export function renderPretty(ribbonFrac: number, width: number, d: Doc): SimpleDoc {
    return renderFits(fits1, ribbonFrac, width, d);
}

/** A slightly smarter rendering algorithm with more lookahead. It provides
 * provide earlier breaking on deeply nested structures For example,
 * consider this python-ish pseudocode: `fun(fun(fun(fun(fun([abcdefg,
 * abcdefg])))))`. If we put a softbreak (+ nesting 2) after each open
 * parenthesis, and align the elements of the list to match the opening
 * brackets, this will render with `renderPretty` and a page width of 20
 * as:
 *
 * ``
 * fun(fun(fun(fun(fun([
 *                     | abcdef,
 *                     | abcdef,
 *                     ]
 *   )))))             |
 * ``
 *
 * Where the 20c. boundary has been marked with |. Because {@link
 * renderPretty} only uses one-line lookahead, it sees that the first line
 * fits, and is stuck putting the second and third lines after the 20-c
 * mark. In contrast, `renderSmart` will continue to check that the
 * potential document up to the end of the indentation level. Thus, it will
 * format the document as:
 *
 * ``
 * fun(                |
 *   fun(              |
 *     fun(            |
 *       fun(          |
 *         fun([       |
 *               abcdef,
 *               abcdef,
 *             ]       |
 *   )))))             |
 * ``
 *
 * Which fits within the 20c. boundary.
 */
export function renderSmart(ribbonFrac: number, width: number, d: Doc): SimpleDoc {
    return renderFits(fitsR, ribbonFrac, width, d);
}

function renderFits(fits: (p: number, m: number, w: number, sd: SimpleDoc) => boolean,
                    rFrac: number, w: number, d: Doc): SimpleDoc {

    // The ribbon width in characters.
    const r = Math.max(0, Math.min(w, Math.round(w * rFrac)));

    // n = indentation of current line
    // k = current column
    // (ie. (k >= n) && (k - n == count of inserted characters)
    function best(n: number, k: number, rf: RestoreFormat, dlist: Docs): SimpleDoc {
        best: while (true) {
            switch (dlist.tag) {
                case DocsTag.DNil:
                    return sEmpty;

                case DocsTag.DCons:
                    const i  = dlist.indent;
                    const d  = dlist.doc;
                    const ds = dlist.docs;
                    switch (d.tag) {
                        case Tag.Fail:          return sFail;
                        case Tag.Empty:         dlist = ds; continue best;
                        case Tag.Text:          return sText(d.text, lazy(() => best(n, k + d.text.length, rf, ds)));
                        case Tag.Line:          return sLine(i, lazy(() => best(i, i, rf, ds)));
                        case Tag.FlatAlt:       dlist = dCons(i, d.fst, ds);                  continue best;
                        case Tag.Cat:           dlist = dCons(i, d.fst, dCons(i, d.snd, ds)); continue best;
                        case Tag.Nest:          dlist = dCons(i + d.level, d.doc, ds);        continue best;
                        case Tag.Union:         return nicest(n, k,
                                                              lazy(() => best(n, k, rf, dCons(i, d.fst, ds))),
                                                              lazy(() => best(n, k, rf, dCons(i, d.snd, ds))));
                        case Tag.Column:        dlist = dCons(i, d.f(k), ds); continue best;
                        case Tag.Columns:       dlist = dCons(i, d.f(w), ds); continue best;
                        case Tag.Nesting:       dlist = dCons(i, d.f(i), ds); continue best;
                        case Tag.Colour:        return sFormat([Fmt.setColour(d.colour)],
                                                               lazy(() => best(n, k, {...rf, colour: d.colour},
                                                                               dCons(i, d.doc, dCons(i, rf, ds)))));
                        case Tag.Obfuscate:     return sFormat([Fmt.obfuscate],
                                                               lazy(() => best(n, k, {...rf, obfuscate: true},
                                                                               dCons(i, d.doc, dCons(i, rf, ds)))));
                        case Tag.Bold:          return sFormat([Fmt.bold],
                                                               lazy(() => best(n, k, {...rf, bold: true},
                                                                               dCons(i, d.doc, dCons(i, rf, ds)))));
                        case Tag.Strikethrough: return sFormat([Fmt.strikethrough],
                                                               lazy(() => best(n, k, {...rf, strikethrough: true},
                                                                               dCons(i, d.doc, dCons(i, rf, ds)))));
                        case Tag.Underline:     return sFormat([Fmt.underline],
                                                               lazy(() => best(n, k, {...rf, underline: true},
                                                                               dCons(i, d.doc, dCons(i, rf, ds)))));
                        case Tag.Italicise:     return sFormat([Fmt.italicise],
                                                               lazy(() => best(n, k, {...rf, italicise: true},
                                                                               dCons(i, d.doc, dCons(i, rf, ds)))));
                        case Tag.RestoreFormat:
                            return sFormat(
                                [ Fmt.reset,
                                  ...(d.colour != null ? [Fmt.setColour(d.colour)] : []),
                                  ...(d.obfuscate      ? [Fmt.obfuscate          ] : []),
                                  ...(d.bold           ? [Fmt.bold               ] : []),
                                  ...(d.strikethrough  ? [Fmt.strikethrough      ] : []),
                                  ...(d.underline      ? [Fmt.underline          ] : []),
                                  ...(d.italicise      ? [Fmt.italicise          ] : []) ],
                                lazy(() => best(n, k, d, ds)));
                    }
            }
        }
    }

    // nicest :: r = ribbon width, w = page width,
    //           n = indentation of the current line, k = current column
    //           x and y, the (simple) documents to choose from.
    //           precondition: first lines of x are longer than the first lines of y.
    function nicest(n: number, k: number, x: SimpleDoc, y: SimpleDoc): SimpleDoc {
        const width = Math.min(w - k, r - k + n);
        return fits(w, Math.min(n, k), width, x) ? x : y;
    }

    const initialFmt: RestoreFormat = {
        tag:           Tag.RestoreFormat,
        colour:        null,
        obfuscate:     false,
        bold:          false,
        strikethrough: false,
        underline:     false,
        italicise:     false
    };
    return best(0, 0, initialFmt, dCons(0, d, dNil));
}

// fits1 does 1 line lookahead.
function fits1(_p: number, _m: number, w: number, sd: SimpleDoc): boolean {
    fits1: while (true) {
        if (w < 0) {
            return false;
        }
        else {
            switch (sd.tag) {
                case STag.SFail:   return false;
                case STag.SEmpty:  return true;
                case STag.SText:
                    w  = w - sd.text.length;
                    sd = sd.succ;
                    continue fits1;
                case STag.SLine:   return true;
                case STag.SFormat:
                    sd = sd.content;
                    continue fits1;
            }
        }
    }
}

// fitsR has a little more lookahead: assuming that nesting roughly
// corresponds to syntactic depth, fitsR checks that not only the current
// line fits, but the entire syntactic structure being formatted at this
// level of indentation fits. If we were to remove the second case for
// SLine, we would check that not only the current structure fits, but also
// the rest of the document, which would be slightly more intelligent but
// would have exponential runtime (and is prohibitively expensive in
// practice).
//
// p = pagewidth
// m = minimum nesting level to fit in
// w = the width in which to fit the first line
function fitsR(p: number, m: number, w: number, sd: SimpleDoc): boolean {
    fitsR: while (true) {
        if (w < 0) {
            return false;
        }
        else {
            switch (sd.tag) {
                case STag.SFail:   return false;
                case STag.SEmpty:  return true;
                case STag.SText:
                    w  = w - sd.text.length;
                    sd = sd.succ;
                    continue fitsR;
                case STag.SLine:
                    if (m < sd.indent) {
                        w  = p - sd.indent;
                        sd = sd.content;
                        continue fitsR;
                    }
                    else {
                        return true;
                    }
                case STag.SFormat:
                    sd = sd.content;
                    continue fitsR;
            }
        }
    }
}

/** `renderCompact(x)` renders document `x` without adding any
 * indentation. Since no "pretty" printing is involved, this renderer is
 * very fast. The resulting output contains fewer characters than a pretty
 * printed version and can be used for output that is read by other
 * programs.
 *
 * This rendering function does not add any colorisation information.
 */
export function renderCompact(x: Doc): SimpleDoc {
    function scan(k: number, docs: Doc[]): SimpleDoc {
        scan: while (true) {
            if (docs.length == 0) {
                return sEmpty;
            }
            else {
                const d  = docs[0]!;
                const ds = docs.slice(1);
                switch (d.tag) {
                    case Tag.Fail:          return sFail;
                    case Tag.Empty:         docs = ds; continue scan;
                    case Tag.Text:          return sText(d.text, lazy(() => scan(k + d.text.length, ds)));
                    case Tag.FlatAlt:       docs = [d.fst, ...ds]; continue scan;
                    case Tag.Line:          return sLine(0, lazy(() => scan(0, ds)));
                    case Tag.Cat:           docs = [d.fst, d.snd, ...ds]; continue scan;
                    case Tag.Nest:          docs = [d.doc, ...ds];        continue scan;
                    case Tag.Union:         docs = [d.snd, ...ds];        continue scan;
                    case Tag.Column:        docs = [d.f(k), ...ds];       continue scan;
                    case Tag.Columns:       docs = [d.f(null), ...ds];    continue scan;
                    case Tag.Nesting:       docs = [d.f(0), ...ds];       continue scan;
                    case Tag.Colour:        docs = [d.doc, ...ds];        continue scan;
                    case Tag.Obfuscate:     docs = [d.doc, ...ds];        continue scan;
                    case Tag.Bold:          docs = [d.doc, ...ds];        continue scan;
                    case Tag.Strikethrough: docs = [d.doc, ...ds];        continue scan;
                    case Tag.Underline:     docs = [d.doc, ...ds];        continue scan;
                    case Tag.Italicise:     docs = [d.doc, ...ds];        continue scan;
                    case Tag.RestoreFormat: docs = ds;                    continue scan;
                }
            }
        }
    }
    return scan(0, [x]);
}

/** `displayS(simpleDoc)` takes the output `simpleDoc` from a
 * rendering function and transforms it to a `string` type.
 *
 * ``javascript
 * function showWidth(w: number, x: Doc): string {
 *     return displayS(renderPretty(0.4, w, x));
 * ``
 */
export function displayS(d: SimpleDoc): string {
    let s = "";
    displayS: while (true) {
        switch (d.tag) {
            case STag.SFail:  throw Error("SFail can not appear uncaught in a rendered SimpleDoc");
            case STag.SEmpty: return s;
            case STag.SText:
                s += d.text;
                d =  d.succ;
                continue displayS;
            case STag.SLine:
                s += "\n" + spaces(d.indent);
                d  = d.content;
                continue displayS;
            case STag.SFormat:
                s += Fmt.toString(d.codes);
                d  = d.content;
                continue displayS;
        }
    }
}
