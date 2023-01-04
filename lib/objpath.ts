/// Object property paths, based on https://github.com/chaijs/pathval

type Path = PropertyKey[];

function parsePath(path: PropertyKey): Path {
    switch (typeof path) {
        case "number":
        case "symbol":
            return [path];

        default:
            const str   = path.replace(/([^\\])\[/g, "$1.[");
            const parts = str.match(/(\\\.|[^.]+?)+/g);
            if (parts) {
                return parts.map((part: string) => {
                    const mInt = /^\[(\d+)\]$/.exec(part);
                    if (mInt) {
                        return Number(mInt[1]);
                    }
                    else {
                        return part.replace(/\\([.[\]])/g, "$1"); // Unescape symbols ., [, and ].
                    }
                });
            }
            else {
                throw new Error("Empty paths are not allowed");
            }
    }
}

export function hasProperty(obj: any, key: PropertyKey): boolean {
    if (typeof obj === "undefined" || obj === null) {
        return false;
    }
    else {
        // The "in" operator does not work with primitives.
        return key in Object(obj);
    }
}

export function internalGetPathValue(obj: any, path: Path, depth: number = path.length): any {
    for (let i = 0; i < depth && i < path.length; i++) {
        if (typeof obj === "undefined" || obj === null) {
            return undefined;
        }
        else {
            const key = path[i]!;
            obj = obj[key];
            if (i === depth - 1) {
                return obj;
            }
        }
    }
    return undefined;
}

export interface PathInfo {
    parent: any,
    key:    PropertyKey,
    value:  any,
    exists: boolean
}

export function getPathInfo(obj: any, path: PropertyKey): PathInfo {
    const parsed = parsePath(path);
    const last   = parsed[parsed.length - 1]!;
    const parent = parsed.length > 1
        ? internalGetPathValue(obj, parsed, parsed.length - 1)
        : obj;
    return {
        parent,
        key:    last,
        value:  internalGetPathValue(parent, [last]),
        exists: hasProperty(parent, last)
    };
}
