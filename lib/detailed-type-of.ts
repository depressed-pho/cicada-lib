export function detailedTypeOf(obj: any): string {
    const primType = typeof obj;
    if (primType !== "object") {
        return primType;
    }

    if (obj === null) {
        return "null";
    }

    if (Array.isArray(obj)) {
        return "Array";
    }

    // Object.prototype.toString is *slow*. Avoid using it whenever
    // possible.
    switch (Object.getPrototypeOf(obj)) {
        case null:               return "object"; // Not "Object"
        case RegExp.prototype:   return "RegExp";
        case Date.prototype:     return "Date";
        case Promise.prototype:  return "Promise";
        case Map.prototype:      return "Map";
        case Set.prototype:      return "Set";
        case WeakMap.prototype:  return "WeakMap";
        case WeakSet.prototype:  return "WeakSet";
        case DataView.prototype: return "DataView";
        default:
            const ty = Object.prototype.toString.call(obj).slice(8, -1);
            return ty === "Object" ? "object" : ty;
    }
}
