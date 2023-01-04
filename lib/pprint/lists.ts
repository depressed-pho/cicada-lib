import { Doc, beside } from "./primitives.js";
import { align, cat, comma, lbrace, lbracket, lparen, rbrace, rbracket,
         rparen, semi } from "./combinators.js";

/** The document `list(ds)` comma separates the documents `ds` and encloses
 * them in square brackets. The documents are rendered horizontally if that
 * fits the page. Otherwise they are aligned vertically. All comma
 * separators are put in front of the elements.
 */
export function list(ds: Doc[]): Doc {
    return encloseSep(lbracket, rbracket, comma, ds);
}

/** The document `tupled(ds)` comma separates the documents `ds` and
 * encloses them in parenthesis. The documents are rendered horizontally if
 * that fits the page. Otherwise they are aligned vertically. All comma
 * separators are put in front of the elements.
 */
export function tupled(ds: Doc[]): Doc {
    return encloseSep(lparen, rparen, comma, ds);
}

/** The document `semiBraces(ds)` separates the documents `ds` with
* semicolons and encloses them in braces. The documents are rendered
* horizontally if that fits the page. Otherwise they are aligned
* vertically. All semicolons are put in front of the elements.
*/
export function semiBraces(ds: Doc[]): Doc {
    return encloseSep(lbrace, rbrace, semi, ds);
}

/** The document `encloseSep(left, right, sep, ds)` concatenates the
 * documents `ds` separated by `sep` and encloses the resulting document by
 * `left` and `right`. The documents are rendered horizontally if that fits
 * the page. Otherwise they are aligned vertically. All separators are put
 * in front of the elements. For example, the combinator {@link list} can
 * be defined with `encloseSep`:
 *
 * ``javascript
 * function list(xs: Doc[]): Doc {
 *     return encloseSep(lbracket, rbracket, comma, xs);
 * }
 * const test = spaceCat(text("list"), list([10, 200, 3000].map(int)));
 * ``
 *
 * Which is layed out with a page width of 20 as:
 *
 * ``
 * list [10,200,3000]
 * ``
 *
 * But when the page width is 15, it is layed out as:
 *
 * ``
 * list [10
 *      ,200
 *      ,3000]
 * ``
 */
export function encloseSep(left: Doc, right: Doc, sep: Doc, ds: Doc[]): Doc {
    switch (ds.length) {
        case 0:
            return beside(left, right);
        case 1:
            return beside(beside(left, ds[0]!), right);
        default:
            return align(
                beside(
                    cat(
                        ds.map((d, i) => beside(i == 0 ? left : sep, d))),
                    right
                )
            );
    }
}

/** `punctuate(p, ds)` concatenates all documents in `ds` with document `p`
 * except for the last document.
 *
 * ``javascript
 * const someText = ["words", "in", "a", "tuple"].map(text);
 * const test     = parens(align(cat(punctuate(comma, someText))));
 * ``
 *
 * This is layed out on a page width of 20 as:
 *
 * ``
 * (words,in,a,tuple)
 * ``
 *
 * But when the page width is 15, it is layed out as:
 *
 * ``
 * (words,
 *  in,
 *  a,
 *  tuple)
 * ``
 *
 * (If you want put the commas in front of their elements instead of at the
 * end, you should use {@link tupled} or, in general, {@link encloseSep}.)
 */
export function punctuate(p: Doc, ds: Doc[]): Doc[] {
    switch (ds.length) {
        case 0: return ds;
        case 1: return ds;
        default:
            return ds.map((d, i) => i == ds.length - 1 ? d : beside(d, p));
    }
}
