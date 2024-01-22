/** The Wadler/Leijen Pretty Printer based on
 * https://hackage.haskell.org/package/ansi-wl-pprint
 */

export { type Doc, type SimpleDoc, empty, text, space, hardline, line,
         linebreak, beside, nest, flatAlt } from "./pprint/primitives.js";
export * from "./pprint/colours.js";
export * from "./pprint/styles.js";
export { group } from "./pprint/flatten.js";
export * from "./pprint/combinators.js";
export * from "./pprint/lists.js";
export * from "./pprint/render.js";
