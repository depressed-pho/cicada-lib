import * as PP from "./pprint.js";
import { lazy } from "./lazy.js";

export interface InspectOptions {
    indentationWidth?: number,
    showHidden?: boolean,
    depth?: number,
    colors?: boolean | ((token: PP.Doc, type: TokenType) => PP.Doc),
    maxArrayLength?: number,
    maxStringLength?: number,
    breakLength?: number,
    compact?: boolean,
    sorted?: boolean | ((x: PropertyKey, y: PropertyKey) => number),
    getters?: boolean | "get" | "set",
    allowCustom?: boolean
}

const defaultOpts: Required<InspectOptions> = {
    indentationWidth: 2,
    showHidden: false,
    depth: 2,
    colors: false,
    maxArrayLength: 100,
    maxStringLength: 10000,
    breakLength: 80,
    compact: false,
    sorted: false,
    getters: true, /* Ideally this should be false, but almost all the
                    * objects coming from "mojang-minecraft" are native
                    * objects with getter/setters. */
    allowCustom: true
};

export enum TokenType {
    BigInt,
    Boolean,
    Date,
    Function,
    Name,
    Null,
    Number,
    RegExp,
    Special,
    String,
    Symbol,
    Undefined,
    Unknown
}

export const customInspectSymbol = Symbol.for("cicada-lib.inspect");

/** An interface for objects implementing a custom inspection method. */
export interface HasCustomInspection {
    [customInspectSymbol](inspect: (value: any, opts?: InspectOptions) => PP.Doc,
                          opts: Required<InspectOptions>
                         ): PP.Doc;
}

interface Context {
    opts: Required<InspectOptions>,
    propFilter: (desc: PropertyDescriptor) => boolean,
    stylise: (token: PP.Doc, type: TokenType) => PP.Doc,
    currentDepth: number,
    seen: Set<any>,
    circular: Map<any, number>
}

const builtinObjectNames: Set<string> =
    new Set(Object.getOwnPropertyNames(globalThis));

/* The TypedArray constructor: used for checking if an object is some kind
 * of TypedArray. */
const TypedArray: Function =
    Object.getPrototypeOf(Int8Array);

const boxedPrimConstructors: Set<Function> = lazy(() => {
    /* The interpreter may not support all the known primitive types. That
     * is, we can't simply do "obj instanceof BigInt" if BigInt isn't
     * supported. */
    const possibleNames = new Set<string>([
        "Number",
        "String",
        "Boolean",
        "BigInt",
        "Symbol"
    ]);
    return new Set<Function>(
        Object.getOwnPropertyNames(globalThis)
              .filter(name => possibleNames.has(name) &&
                              typeof (globalThis as any)[name] === "function")
              .map(name => (globalThis as any)[name] as Function));
});

/* Object.hasOwn() is not available everywhere. This is an alternative
 * implementation. */
function hasOwn(obj: any, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

/* Object.prototype.propertyIsEnumerable() may be overridden by
 * subclasses. Invoke the original method. */
function propertyIsEnumerable(obj: any, key: PropertyKey): boolean {
    return Object.prototype.propertyIsEnumerable.call(obj, key);
}

/* Object.prototype.valueOf() may be overridden by subclasses. Invoke the
 * original method. This function throws if obj isn't a boxed primitive. */
function valueOf(ctor: Function, obj: any): any {
    const prim = ctor.prototype.valueOf.call(obj);
    if (typeof prim === "object") {
        throw new Error("valueOf() applied to a non-primitive wrapper");
    }
    else {
        return prim;
    }
}

export function inspect(value: any, opts: InspectOptions = {}): string {
    const ctx: Context = {
        opts:           {...defaultOpts, ...opts},
        propFilter:     opts.showHidden ? pAllProperties : pOnlyEnumerable,
        stylise:        typeof opts.colors === "function" ? opts.colors
                        : opts.colors                     ? styliseWithColour
                        :                                   styliseNoColour,
        currentDepth:   0,
        seen:           new Set<any>(),
        circular:       new Map<any, number>()
    };
    const doc  = inspectValue(value, ctx);
    const sDoc = opts.compact
        ? PP.renderCompact(doc)
        : PP.renderSmart(0.9, ctx.opts.breakLength, doc);
    return PP.displayS(sDoc);
}

function styliseNoColour(token: PP.Doc, _type: TokenType): PP.Doc {
    return token;
}

const defaultStyles = lazy(() => {
    return new Map<TokenType, (token: PP.Doc) => PP.Doc>([
        [TokenType.BigInt   , PP.yellow   ],
        [TokenType.Boolean  , PP.yellow   ],
        [TokenType.Date     , PP.pink     ],
        [TokenType.Function , PP.orange   ],
        [TokenType.Name     , (d) => d    ], // Don't style them.
        [TokenType.Null     , PP.bold     ],
        [TokenType.Number   , PP.yellow   ],
        [TokenType.RegExp   , PP.lightBlue],
        [TokenType.Special  , PP.gray     ],
        [TokenType.String   , PP.green    ],
        [TokenType.Symbol   , PP.green    ],
        [TokenType.Undefined, PP.gray     ],
        [TokenType.Unknown  , PP.italicise]
    ]);
});
function styliseWithColour(token: PP.Doc, type: TokenType): PP.Doc {
    const f = defaultStyles.get(type);
    return f ? f(token) : PP.italicise(token);
}

function pAllProperties(_desc: PropertyDescriptor): boolean {
    return true;
}

function pOnlyEnumerable(desc: PropertyDescriptor): boolean {
    return !!desc.enumerable;
}

function inspectValue(val: any, ctx: Context): PP.Doc {
    switch (typeof val) {
        case "undefined":
            return ctx.stylise(PP.text("undefined"), TokenType.Undefined);
        case "boolean":
            return ctx.stylise(PP.bool(val), TokenType.Boolean);
        case "number":
            return inspectNumber(val, ctx);
        case "bigint":
            return inspectBigInt(val, ctx);
        case "string":
            return inspectString(val, ctx);
        case "symbol":
            return ctx.stylise(PP.text(val.toString()), TokenType.Symbol);
        case "function":
            return inspectObject(val, ctx);
        case "object":
            if (val === null) {
                return ctx.stylise(PP.text("null"), TokenType.Null);
            }
            else {
                return inspectObject(val, ctx);
            }
        default:
            return ctx.stylise(PP.text(String(val)), TokenType.Unknown);
    }
}

function inspectNumber(num: number, ctx: Context): PP.Doc {
    if (Object.is(num, -0)) {
        // Mathematical nonsence... This is the only way to distinguish 0
        // from -0. LOL.
        return ctx.stylise(PP.text("-0"), TokenType.Number);
    }
    else {
        return ctx.stylise(PP.number(num), TokenType.Number);
    }
}

function inspectBigInt(int: bigint, ctx: Context): PP.Doc {
    return ctx.stylise(PP.text(`${String(int)}n`), TokenType.BigInt);
}

function inspectString(str: string, ctx: Context): PP.Doc {
    let trailer = PP.empty;
    if (str.length > ctx.opts.maxStringLength) {
        const remaining = str.length - ctx.opts.maxStringLength;
        str     = str.slice(0, ctx.opts.maxStringLength);
        trailer = PP.fillSep(
            `... ${remaining} more character${remaining > 1 ? "s" : ""}`.split(" ").map(PP.text));
    }
    return PP.beside(
        PP.nest(
            ctx.opts.indentationWidth,
            PP.hcat(
                PP.punctuate(
                    PP.beside(
                        PP.text(" +"),
                        PP.hardline),
                    str.split(/(?<=\n)/)
                       .map(line => ctx.stylise(PP.text(JSON.stringify(line)), TokenType.String))))),
        trailer);
}

function inspectObject(obj: any, ctx: Context): PP.Doc {
    /* NOTE: We don't think we can tell proxies from their targets from
     * within JavaScript. Node.js "util.inspect" uses an internal API of
     * the interpreter which we can't do the same. */

    // Check if the object implements HasCustomInspection if we are allowed
    // to do so.
    if (ctx.opts.allowCustom) {
        const custom = obj[customInspectSymbol];
        if (typeof custom === "function" &&
            // Filter out prototype objects such as "(class {}).prototype",
            // because their methods aren't meant to be called in this way.
            !(obj.constructor && obj.constructor.prototype === obj)) {

            try {
                return custom.call(
                    obj,
                    (value: any, opts?: InspectOptions) => {
                        if (value === obj)
                            throw new Error(
                                "The custom inspection method called inspect() on `this', " +
                                    "which would go into infinite recursion");
                        // Merge options if given.
                        const ctx1 = {
                            ...ctx,
                            ...(opts ? {opts: {...ctx.opts, ...opts}} : {})
                        };
                        return inspectValue(value, ctx1);
                    },
                    ctx.opts);
            }
            catch (err) {
                return ctx.stylise(
                    PP.text(`<Inspection threw: ${err}>`), TokenType.Special);
            }
        }
    }

    // Detect circular references.
    if (ctx.seen.has(obj)) {
        let idx = ctx.circular.get(obj);
        if (idx == null) {
            idx = ctx.circular.size + 1;
            ctx.circular.set(obj, idx);
        }
        return ctx.stylise(PP.text(`[Circular *${idx}]`), TokenType.Special);
    }

    const ctorName = getConstructorName(obj, ctx);
    // Only list the tag in case it's non-enumerable / not an own property,
    // otherwise we'd print this twice.
    const tag      = ctx.opts.showHidden
        ? (hasOwn              (obj, Symbol.toStringTag) ? undefined : obj[Symbol.toStringTag])
        : (propertyIsEnumerable(obj, Symbol.toStringTag) ? undefined : obj[Symbol.toStringTag]);

    // If we have recursed too many times, only show the name of
    // constructor and exit.
    if (ctx.currentDepth > ctx.opts.depth) {
        const prefix = mkPrefix(ctorName, tag, "Object");
        return ctx.stylise(PP.brackets(prefix), TokenType.Special);
    }

    const protoProps = ctx.opts.showHidden
        ? getPrototypeProperties(obj, ctx)
        : [];

    let inspector: (obj: any, ctx: Context) => PP.Doc[];
    let braces: [PP.Doc, PP.Doc];
    let props: [PropertyKey, PropertyDescriptor][];
    if (Array.isArray(obj)) {
        // Only show the constructor for non-ordinary ("Foo(n) [...]") arrays.
        const prefix = (ctorName !== "Array" || tag != null)
            ? PP.beside(mkPrefix(ctorName, tag, "Array", obj.length), PP.space)
            : PP.empty;
        inspector = inspectArray;
        braces    = [PP.beside(prefix, PP.lbracket), PP.rbracket];
        // Extra non-index properties: some arrays have ones.
        props     = getOwnProperties(obj, ctx, key => !isIndex(key));
    }
    else if (obj instanceof TypedArray) {
        // Don't be confused: TypedArray isn't a global object.
        const prefix = PP.beside(
            mkPrefix(ctorName, tag, (obj as any).name, (obj as any).length),
            PP.space);
        inspector = inspectTypedArray;
        braces    = [PP.beside(prefix, PP.lbracket), PP.rbracket];
        props     = getOwnProperties(obj, ctx, key => !isIndex(key));
    }
    else if (obj instanceof Set) { // Not great, but there is no Set.isSet().
        const prefix = PP.beside(mkPrefix(ctorName, tag, "Set", obj.size), PP.space);
        inspector = inspectSet;
        braces    = [PP.beside(prefix, PP.lbrace), PP.rbrace];
        props     = getOwnProperties(obj, ctx);
    }
    else if (obj instanceof Map) {
        const prefix = PP.beside(mkPrefix(ctorName, tag, "Set", obj.size), PP.space);
        inspector = inspectMap;
        braces    = [PP.beside(prefix, PP.lbrace), PP.rbrace];
        props     = getOwnProperties(obj, ctx);
    }
    else if (typeof obj === "function") {
        const prefix = mkFunctionPrefix(obj, ctorName, tag);
        const base   = ctx.stylise(prefix, TokenType.Function);
        props = getOwnProperties(obj, ctx);
        if (props.length == 0 && protoProps.length == 0) {
            // Special case: the function has no extra properties.
            return base;
        }
        inspector = inspectNothing;
        braces    = [PP.spaceCat(base, PP.lbrace), PP.rbrace];
    }
    else if (obj instanceof RegExp) {
        const prefix = mkRegExpPrefix(ctorName, tag);
        const base   = ctx.stylise(PP.beside(prefix, PP.text(obj.toString())), TokenType.RegExp);
        props = getOwnProperties(obj, ctx);
        if (props.length == 0 && protoProps.length == 0) {
            // Special case: the RegExp has no extra properties.
            return base;
        }
        inspector = inspectNothing;
        braces    = [PP.spaceCat(base, PP.lbrace), PP.rbrace];
    }
    else if (obj instanceof Date) {
        const prefix = PP.beside(mkDatePrefix(ctorName, tag), PP.space);
        // THINKME: Maybe we should use toISOString() instead?
        const base   = ctx.stylise(PP.beside(prefix, PP.text(obj.toLocaleString())), TokenType.Date);
        props = getOwnProperties(obj, ctx);
        if (props.length == 0 && protoProps.length == 0) {
            // Special case: the Date has no extra properties.
            return base;
        }
        inspector = inspectNothing;
        braces    = [PP.spaceCat(base, PP.lbrace), PP.rbrace];
    }
    else if (obj instanceof Error) {
        const prefix = mkErrorPrefix(obj, ctorName, tag, ctx);
        const base   = PP.nest(ctx.opts.indentationWidth, prefix);
        // These values are already included in the prefix. Hide them by
        // default.
        const dupes  = new Set<PropertyKey>(["name", "message", "stack"]);
        props = getOwnProperties(obj, ctx, key => ctx.opts.showHidden || !dupes.has(key));

        // Print .cause even if it's not enumerable.
        if ("cause" in obj && !props.some(([key, ]) => key == "cause")) {
            props.push(["cause", {value: obj.cause}]);
        }

        // Print .errors in AggregateError even if it's not enumerable.
        if ("errors" in obj &&
            Array.isArray((obj as any).errors) &&
            !props.some(([key, ]) => key == "errors")) {

            props.push(["errors", {value: (obj as any).errors}]);
        }

        if (props.length == 0 && protoProps.length == 0) {
            // Special case: the Error has no extra properties.
            return base;
        }

        inspector = inspectNothing;
        braces    = [PP.spaceCat(base, PP.lbrace), PP.rbrace];
    }
    else if (obj instanceof ArrayBuffer || obj instanceof SharedArrayBuffer) {
        const prefix = PP.beside(mkPrefix(ctorName, tag, "<unknown>"), PP.space);
        inspector = inspectNothing;
        braces    = [PP.beside(prefix, PP.lbrace), PP.rbrace];
        props     = getOwnProperties(obj, ctx);
        // Print .byteLength even if it's not enumerable. It might be a
        // special property that even Object.getOwnPropertyDescriptor()
        // doesn't find.
        if (!props.some(([key, ]) => key == "byteLength")) {
            const desc = Object.getOwnPropertyDescriptor(obj, "byteLength");
            props.push(["byteLength", desc || {value: obj.byteLength}]);
        }
    }
    else if (obj instanceof DataView) {
        const prefix = PP.beside(mkPrefix(ctorName, tag, "DataView"), PP.space);
        inspector = inspectNothing;
        braces    = [PP.beside(prefix, PP.lbrace), PP.rbrace];
        props     = getOwnProperties(obj, ctx);
        // Print its certain properties even if they aren't
        // enumerable. They might be special properties that even
        // Object.getOwnPropertyDescriptor() doesn't find.
        for (const k of ["byteLength", "byteOffset", "buffer"]) {
            if (!props.some(([key, ]) => key == k)) {
                const desc = Object.getOwnPropertyDescriptor(obj, k);
                props.push([k, desc || {value: (obj as any)[k]}]);
            }
        }
    }
    else if (obj instanceof Promise) {
        const prefix = PP.beside(mkPrefix(ctorName, tag, "Promise"), PP.space);
        // NOTE: It is impossible to inspect the internal state of Promise
        // without using interpreter-specific private methods.
        inspector = () => [ctx.stylise(PP.text("<state unknown>"), TokenType.Special)];
        braces    = [PP.beside(prefix, PP.lbrace), PP.rbrace];
        props     = getOwnProperties(obj, ctx);
    }
    else if (obj instanceof WeakSet || obj instanceof WeakMap) {
        const prefix = PP.beside(mkPrefix(ctorName, tag, "<unknown>"), PP.space);
        // NOTE: It is impossible to inspect the elements of weak
        // containers without using interpreter-specific private methods.
        inspector = () => [ctx.stylise(PP.text("<items unknown>"), TokenType.Special)];
        braces    = [PP.beside(prefix, PP.lbrace), PP.rbrace];
        props     = getOwnProperties(obj, ctx);
    }
    else if ("WeakRef" in globalThis && obj instanceof WeakRef) {
        const prefix = PP.beside(mkPrefix(ctorName, tag, "WeakRef"), PP.space);
        inspector = inspectWeakRef;
        braces    = [PP.beside(prefix, PP.lbrace), PP.rbrace];
        props     = getOwnProperties(obj, ctx);
    }
    else if (obj.constructor != null && boxedPrimConstructors.has(obj.constructor)) {
        const prefix = mkBoxedPrimPrefix(ctorName!, tag);
        const base   = PP.spaceCat(prefix, inspectValue(valueOf(obj.constructor, obj), ctx));
        props     = getOwnProperties(obj, ctx);
        if (props.length == 0 && protoProps.length == 0) {
            // Special case: the boxed primitive has no extra properties.
            return base;
        }
        inspector = inspectNothing;
        braces    = [PP.spaceCat(base, PP.lbrace), PP.rbrace];
    }
    else if (Object.prototype.toString.call(obj) === "[Object Arguments]") {
        // This appears to be the only way to detect Arguments objects. We
        // hate Object.prototype.toString, because it's so slow, but we
        // have no other choices.
        inspector = inspectArray;
        braces    = [PP.spaceCat(PP.text("Arguments"), PP.lbracket), PP.rbracket];
        props     = getOwnProperties(obj, ctx, key => !isIndex(key));
    }
    else {
        const prefix = mkPlainObjectPrefix(ctorName, tag);
        inspector = inspectNothing;
        braces    = [PP.beside(prefix, PP.lbrace), PP.rbrace];
        props     = getOwnProperties(obj, ctx);
    }

    if (ctx.opts.showHidden) {
        props.push(...protoProps);
    }
    if (ctx.opts.sorted) {
        if (typeof ctx.opts.sorted === "function") {
            props.sort(([k1, ], [k2, ]) => (ctx.opts.sorted as any)(k1, k2));
        }
        else {
            props.sort();
        }
    }

    ctx.seen.add(obj);
    ctx.currentDepth++;
    const elems = inspector(obj, ctx);
    elems.push(
        ...(props.map(([key, desc]) => inspectProperty(obj, key, desc, ctx))));
    ctx.currentDepth--;
    ctx.seen.delete(obj);

    /* Inspecting the elements may recurse into inspectObject() and may
     * find circular references. When that happens there will be an entry
     * in the circulation map for the object we are inspecting. */
    const circulationIdx = ctx.circular.get(obj);
    if (circulationIdx != null) {
        /* Attach a circulation reference to the opening brace.
         *
         *   let foo = {};
         *   foo.bar = foo;
         *
         * The above object foo will be shown as:
         *
         *   <ref *1> { bar: [Circular *1] }
         */
        braces[0] = PP.spaceCat(
            ctx.stylise(PP.text(`<ref *${circulationIdx}>`), TokenType.Special),
            braces[0]);
    }

    // If the entire object fits the line, print it in a single
    // line. Otherwise break lines for each element of the object.
    return PP.group(
        PP.lineCat(
            PP.nest(
                ctx.opts.indentationWidth,
                PP.lineCat(
                    braces[0],
                    PP.vsep(
                        PP.punctuate(
                            PP.comma, elems)))),
            braces[1]));
}

function inspectNothing(_val: any, _ctx: Context): PP.Doc[] {
    return [];
}

function inspectArray(arr: any[], ctx: Context): PP.Doc[] {
    const numElemsToShow = Math.min(arr.length, ctx.opts.maxArrayLength);
    const numHidden      = arr.length - numElemsToShow;
    const elems          = [];
    for (let i = 0; i < numElemsToShow; i++) {
        const key  = String(i);
        const desc = Object.getOwnPropertyDescriptor(arr, key);
        if (desc) {
            elems.push(inspectProperty(arr, key, desc, ctx, true));
        }
        else {
            // Missing index: this is a sparse array.
            return inspectSparseArray(arr, ctx);
        }
    }
    if (numHidden > 0) {
        elems.push(remainingText(numHidden));
    }
    return elems;
}

function inspectSparseArray(arr: any[], ctx: Context): PP.Doc[] {
    const numElemsToShow = Math.min(arr.length, ctx.opts.maxArrayLength);
    const props          = Object.entries(Object.getOwnPropertyDescriptors(arr));
    const elems          = [];

    let expectedIdx = 0;
    for (const [key, desc] of props) {
        if (elems.length > numElemsToShow) {
            break;
        }
        if (String(expectedIdx) !== key) {
            if (!isIndex(key)) {
                break;
            }
            const actualIdx = Number(key);
            const numHoles  = actualIdx - expectedIdx;
            elems.push(
                ctx.stylise(
                    PP.text(`<${numHoles} empty item${numHoles > 1 ? "s" : ""}>`),
                    TokenType.Undefined));
            expectedIdx = actualIdx;
        }
        elems.push(inspectProperty(arr, key, desc, ctx, true));
        expectedIdx++;
    }

    const numHidden = arr.length - expectedIdx;
    if (numHidden > 0) {
        elems.push(remainingText(numHidden));
    }
    return elems;
}

function inspectTypedArray(arr: any, ctx: Context): PP.Doc[] {
    const numElemsToShow = Math.min(arr.length, ctx.opts.maxArrayLength);
    const numHidden      = arr.length - numElemsToShow;
    const elems          = new Array(numElemsToShow);
    const elemInspector  = arr.length > 0 && typeof arr[0] === "number"
                           ? inspectNumber
                           : inspectBigInt;
    for (let i = 0; i < numElemsToShow; i++) {
        elems[i] = (elemInspector as any)(arr[i], ctx);
    }
    if (numHidden > 0) {
        elems.push(remainingText(numHidden));
    }
    return elems;
}

function inspectSet(set: Set<any>, ctx: Context): PP.Doc[] {
    const numElemsToShow = Math.min(set.size, ctx.opts.maxArrayLength);
    const numHidden      = set.size - numElemsToShow;
    const elems          = [];
    for (const elem of set) {
        if (elems.length >= numElemsToShow) {
            break;
        }
        elems.push(inspectValue(elem, ctx));
    }
    if (numHidden > 0) {
        elems.push(remainingText(numHidden));
    }
    return elems;
}

function inspectMap(map: Map<any, any>, ctx: Context): PP.Doc[] {
    const numElemsToShow = Math.min(map.size, ctx.opts.maxArrayLength);
    const numHidden      = map.size - numElemsToShow;
    const elems          = [];
    for (const [key, val] of map) {
        if (elems.length >= numElemsToShow) {
            break;
        }
        elems.push(
            PP.fillSep(
                [ inspectValue(key, ctx),
                  PP.text("=>"),
                  inspectValue(val, ctx)
                ]));
    }
    if (numHidden > 0) {
        elems.push(remainingText(numHidden));
    }
    return elems;
}

function inspectWeakRef(ref: WeakRef<any>, ctx: Context): PP.Doc[] {
    const target = ref.deref();
    if (target === undefined) {
        return [
            ctx.stylise(
                PP.text("<Object already reclaimed>"),
                TokenType.Undefined)
        ];
    }
    else {
        return [inspectValue(target, ctx)];
    }
}

function inspectProperty(obj: any, key: PropertyKey, desc: PropertyDescriptor,
                         ctx: Context, valueOnly = false): PP.Doc {
    let value: PP.Doc;
    if (desc.value !== undefined) {
        value = inspectValue(desc.value, ctx);
    }
    else if (desc.get !== undefined) {
        const label = desc.set !== undefined
            ? ctx.stylise(PP.text("[Getter/Setter]"), TokenType.Special)
            : ctx.stylise(PP.text("[Getter]"       ), TokenType.Special)
        if (ctx.opts.getters === true ||
            (ctx.opts.getters === "get" && desc.set === undefined) ||
            (ctx.opts.getters === "set" && desc.set !== undefined)) {
            try {
                const v = desc.get.call(obj);
                value = PP.spaceCat(label, inspectValue(v, ctx));
            }
            catch (err) {
                value = PP.spaceCat(
                    label,
                    ctx.stylise(PP.text(`<Inspection threw: ${err}>`), TokenType.Special));
            }
        }
        else {
            value = label;
        }
    }
    else if (desc.set !== undefined) {
        value = ctx.stylise(PP.text("[Setter]"), TokenType.Special);
    }
    else {
        value = ctx.stylise(PP.text("undefined"), TokenType.Undefined);
    }

    if (valueOnly) {
        return value;
    }
    else {
        let name: PP.Doc;
        if (typeof key === "symbol") {
            name = ctx.stylise(PP.text(key.toString()), TokenType.Symbol);
        }
        else if (!desc.enumerable) {
            name = ctx.stylise(PP.brackets(PP.text(String(key))), TokenType.Name);
        }
        else if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(String(key))) {
            name = ctx.stylise(PP.text(String(key)), TokenType.Name);
        }
        else {
            name = ctx.stylise(PP.text(JSON.stringify(key)), TokenType.String);
        }

        return PP.softlineCat(PP.beside(name, PP.colon), value);
    }
}

function remainingText(numHidden: number): PP.Doc {
    return PP.fillSep(
        `... ${numHidden} more item${numHidden > 1 ? "s" : ""}`.split(" ").map(PP.text));
}

function getConstructorName(obj: any, ctx: Context): string|null {
    for (let i = 0; obj; i++) {
        if (i >= ctx.opts.depth) {
            return "<Complex prototype>";
        }
        else {
            const ctorDesc = Object.getOwnPropertyDescriptor(obj, "constructor");
            if (ctorDesc) {
                return ctorDesc.value.name;
            }
            obj = Object.getPrototypeOf(obj);
        }
    }
    return null;
}

function getOwnProperties(obj: any,
                          ctx: Context,
                          keyFilter?: (key: PropertyKey) => boolean
                         ): [PropertyKey, PropertyDescriptor][] {
    if (keyFilter) {
        return Reflect.ownKeys(obj)
                      .filter(keyFilter)
                      .map(key => [key, Object.getOwnPropertyDescriptor(obj, key)] as any)
                      .filter(([, desc]) => ctx.propFilter(desc));
    }
    else {
        return Object.entries(Object.getOwnPropertyDescriptors(obj))
                     .filter(([, desc]) => ctx.propFilter(desc));
    }
}

function getPrototypeProperties(obj: any, ctx: Context): [PropertyKey, PropertyDescriptor][] {
    const keys = new Set<PropertyKey>();
    const props: [PropertyKey, PropertyDescriptor][] = [];
    obj = Object.getPrototypeOf(obj);
    for (let i = 0; i < ctx.opts.depth; i++) {
        // Stop as soon as a null prototype is encountered.
        if (obj == null) {
            break;
        }

        // Stop as soon as a built-in object type is detected. Nothing good
        // come from reflecting built-in objects. It can even enter into an
        // infinite loop for some unknown reason (a possible bug in the
        // interpreter).
        const ctorDesc = Object.getOwnPropertyDescriptor(obj, "constructor");
        if (ctorDesc && builtinObjectNames.has(ctorDesc.value.name)) {
            break;
        }

        for (const key of Reflect.ownKeys(obj)) {
            /* Ignore constructors: they are separately inspected. */
            if (key !== "constructor" && !keys.has(key)) {
                keys.add(key);
                props.push([key, Object.getOwnPropertyDescriptor(obj, key)!]);
            }
        }
        obj = Object.getPrototypeOf(obj);
    }
    return props;
}

// Do not use this for functions, classes, RegExps, Dates, Errors, boxed
// primitives, or plain Objects.
function mkPrefix(ctorName: string|null, tag: string|null, fallback: string, size?: number): PP.Doc {
    const sizeStr = size != null ? `(${size})` : "";

    if (ctorName != null) {
        if (tag != null && tag != ctorName) {
            return PP.text(`${ctorName}${sizeStr} [${tag}]`);
        }
        else {
            return PP.text(`${ctorName}${sizeStr}`);
        }
    }
    else {
        if (tag != null && tag != fallback) {
            return PP.text(`[${fallback}${sizeStr}] [${tag}]`);
        }
        else {
            return PP.text(`[${fallback}${sizeStr}]`);
        }
    }
}

function mkFunctionPrefix(func: Function, ctorName: string|null, tag: string|null): PP.Doc {
    let stringified = Function.prototype.toString.call(func);
    if (/^class\s+/.test(stringified)) {
        // Gee... is this the only way to test if a function is actually a
        // class constructor? Seriously?
        return mkClassPrefix(func, ctorName, tag);
    }
    else {
        // We need to reconstruct the exact type of function, and there
        // seems to be no better ways than this. LOL.
        const mAsync  = stringified.match(/^async\s+(.+)$/);
        const isAsync = mAsync != null;
        if (mAsync) {
            stringified = mAsync[1]!;
        }
        const isGenerator = /^function\*\s+/.test(stringified);
        const typeName    =
            (isAsync     ? "Async"     : "") +
            (isGenerator ? "Generator" : "") +
            "Function";

        let prefix = PP.brackets(
            PP.beside(
                PP.text(typeName),
                func.name != "" ? PP.text(`: ${func.name}`) : PP.text(" (anonymous)")));

        if (ctorName == null) {
            prefix = PP.spaceCat(prefix, PP.text("(null prototype)"));
        }
        else if (ctorName != typeName) {
            prefix = PP.spaceCat(prefix, PP.text(ctorName));
        }

        if (tag != null && tag != ctorName) {
            prefix = PP.spaceCat(prefix, PP.brackets(PP.text(tag)));
        }

        return prefix;
    }
}

function mkClassPrefix(func: Function, ctorName: string|null, tag: string|null): PP.Doc {
    let prefix = PP.spaceCat(
        PP.text("class"),
        func.name != "" ? PP.text(func.name) : PP.text("(anonymous)"));

    if (ctorName != null && ctorName != "Function") {
        prefix = PP.spaceCat(prefix, PP.brackets(PP.text(ctorName)));
    }

    if (tag != null && tag != ctorName) {
        prefix = PP.spaceCat(prefix, PP.brackets(PP.text(tag)));
    }

    if (ctorName != null) {
        const proto = Object.getPrototypeOf(func);
        if (proto && proto.name) {
            prefix = PP.spaceCat(prefix, PP.text(`extends ${proto.name}`));
        }
    }
    else {
        prefix = PP.spaceCat(prefix, PP.text("extends (null constructor)"));
    }

    return PP.brackets(prefix);
}

function mkRegExpPrefix(ctorName: string|null, tag: string|null): PP.Doc {
    let prefix;

    // Don't name the constructor if it's "RegExp".
    if (ctorName != null && ctorName != "RegExp") {
        prefix = PP.beside(PP.text(ctorName), PP.space);
    }
    else {
        prefix = PP.empty;
    }

    if (tag != null && tag != ctorName) {
        prefix = PP.beside(prefix, PP.beside(PP.brackets(PP.text(tag)), PP.space));
    }

    return prefix;
}

function mkDatePrefix(ctorName: string|null, tag: string|null): PP.Doc {
    let prefix;

    // Always enclose the name of constructor.
    if (ctorName != null && ctorName != "Date") {
        prefix = PP.brackets(PP.text(ctorName));
    }
    else {
        prefix = PP.text("[Date]");
    }

    if (tag != null && tag != ctorName) {
        prefix = PP.spaceCat(prefix, PP.brackets(PP.text(tag)));
    }

    return prefix;
}

function mkErrorPrefix(err: Error,
                       ctorName: string|null,
                       tag: string|null,
                       ctx: Context): PP.Doc {
    const name =
          err.name != null ? String(err.name)
        : ctorName != null ? ctorName
        : "Error";
    const message = err.message != null ? String(err.message) : "";

    // Error.prototype.stack is a non-standard property and we can make
    // ABSOLUTELY NO assumptions about its contents.
    let stack = err.stack != null ? String(err.stack) : "";

    if (stack.includes(name) && stack.includes(message)) {
        // .stack contains both the name and the message. *Assume* the
        // first line of .stack is where they are shown. There is nowhere
        // we can put the tag but we can't do anything about it.
    }
    else {
        let taggedName = name;
        if (ctorName != null && ctorName != name) {
            // It's not a good idea to show the name of the constructor by
            // default, because the whole point of overwriting .name is to
            // clobber it.
            if (ctx.opts.showHidden) {
                taggedName += ` [${ctorName}]`;
            }
        }
        if (tag != null && tag != ctorName) {
            taggedName += ` [${tag}]`;
        }
        stack =
            (message != "" ? `${taggedName}: ${message}` : taggedName) +
            (stack   != "" ? "\n" + stack                : ""        );
    }

    // Remove potential indentations of the stacktrace, since we do it in
    // our own way.
    const lines = stack.split("\n").map(line => PP.text(line.trim()));

    if (lines.length == 1) {
        // There seems to be no stack trace. Wrap it in brackets.
        return PP.brackets(lines[0]!);
    }
    else {
        return PP.hcat(PP.punctuate(PP.hardline, lines));
    }
}

function mkBoxedPrimPrefix(ctorName: string, tag: string|null): PP.Doc {
    let prefix = PP.brackets(PP.text(ctorName));

    if (tag != null && tag != ctorName) {
        prefix = PP.spaceCat(prefix, PP.brackets(PP.text(tag)));
    }

    return prefix;
}

function mkPlainObjectPrefix(ctorName: string|null, tag: string|null): PP.Doc {
    let prefix;

    if (ctorName != null && ctorName != "Object") {
        prefix = PP.beside(PP.text(ctorName), PP.space);
    }
    else {
        prefix = PP.empty;
    }

    if (tag != null && tag != ctorName) {
        prefix = PP.beside(prefix, PP.beside(PP.brackets(PP.text(tag)), PP.space));
    }

    return prefix;
}

function isIndex(key: PropertyKey): boolean {
    switch (typeof key) {
        case "string":
            return /^[0-9]+$/.test(key);
        case "number":
            return true;
        default:
            return false;
    }
}
