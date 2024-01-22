import { lazy } from "../lazy.js";
import { Doc, Tag, beside, nest, fail, column, columns,
         nesting, union } from "./primitives.js";
import { colour } from "./colours.js"
import { obfuscate, deobfuscate, bold, debold,
         italicise, deitalicise } from "./styles.js"

/** The `group` combinator is used to specify alternative layouts. The
 * document `group(d)` undoes all line breaks in document `d`. The
 * resulting line is added to the current line if that fits the
 * page. Otherwise, the document `d` is rendered without any changes.
 */
export function group(d: Doc): Doc {
    return union(lazy(() => flatten(d)), d);
}

// Most JS interpreters don't eliminate tail-calls. Even V8 doesn't. We
// have to manually do it, or this function becomes a source of frequent
// stack overflows. We also do lazy evaluation extensively so that
// non-tail-calls don't overflow the stack.
export function flatten(doc: Doc): Doc {
    flatten: while (true) {
        const d = doc;
        switch (d.tag) {
            case Tag.Fail:          return d;
            case Tag.Empty:         return d;
            case Tag.Text:          return d;
            case Tag.FlatAlt:       return d.snd;
            case Tag.Cat:           return beside(lazy(() => flatten(d.fst)),
                                                  lazy(() => flatten(d.snd)));
            case Tag.Nest:          return nest(d.level, lazy(() => flatten(d.doc)));
            case Tag.Line:          return fail;
            case Tag.Union:         doc = d.fst; continue flatten;
            case Tag.Column:        return column(n => flatten(d.f(n)));
            case Tag.Columns:       return columns(n => flatten(d.f(n)));
            case Tag.Nesting:       return nesting(n => flatten(d.f(n)));
            case Tag.Colour:        return colour(d.colour, lazy(() => flatten(d.doc)));
            case Tag.Obfuscate:     return d.enabled
                                             ? obfuscate  (lazy(() => flatten(d.doc)))
                                             : deobfuscate(lazy(() => flatten(d.doc)));
            case Tag.Bold:          return d.enabled
                                             ? bold  (lazy(() => flatten(d.doc)))
                                             : debold(lazy(() => flatten(d.doc)));
            case Tag.Italicise:     return d.enabled
                                             ? italicise  (lazy(() => flatten(d.doc)))
                                             : deitalicise(lazy(() => flatten(d.doc)));
            case Tag.RestoreFormat: return d;
        }
    }
}
