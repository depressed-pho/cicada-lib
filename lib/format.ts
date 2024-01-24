import { InspectOptions, inspect } from "./inspect.js";

export function format(fmt: string, ...args: any[]): string {
    return formatWithOptions({}, fmt, ...args);
}

export function formatWithOptions(opts: InspectOptions, fmt: string, ...args: any[]): string {
    const str = fmt.replaceAll(
        /%(%|[oO]|(?:([0-9]*)\.([0-9]*))?[di]|s|(?:([0-9]*)\.([0-9]*))?f)/g,
        (matched, subst, intWidth, intPrec, floatWidth, floatPrec) => {
            switch (subst) {
                case "%":
                    return "%";
                case "o":
                    return args.length > 0
                        ? inspect(args.shift(), opts)
                        : matched;
                case "O":
                    return args.length > 0
                        ? inspect(args.shift(), {...opts, showHidden: true})
                        : matched;
                case "d":
                case "i":
                    return args.length > 0
                        ? String(Number(args.shift()))
                        : matched;
                case "s":
                    return args.length > 0
                        ? String(args.shift())
                        : matched;
                default:
                    if (intWidth != null || intPrec != null) {
                        if (args.length > 0) {
                            const int = args.shift();
                            return String(int)
                                .padStart(intPrec  || 0, "0")
                                .padStart(intWidth || 0, " ");
                        }
                        else {
                            return matched;
                        }
                    }
                    else if (floatWidth != null || floatPrec != null) {
                        if (args.length > 0) {
                            const float = args.shift();
                            const str   = floatPrec != null
                                ? Number(float).toFixed(floatPrec)
                                : String(float);
                            return str.padStart(floatWidth || 0, " ");
                        }
                        else {
                            return matched;
                        }
                    }
                    else {
                        throw Error("internal error: impossible");
                    }
            }
        });
    /* Any remaining arguments should be appended to the result. They
     * weren't consumed by the format string. */
    return [str, ...(args.map(val => stringify(val, opts)))].join(" ");
}

export function stringify(val: any, opts: InspectOptions = {}): string {
    switch (typeof val) {
        case "string":
            return val;
        default:
            return inspect(val, opts);
    }
}
