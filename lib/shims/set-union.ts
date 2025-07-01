/** For JavaScript implementation lacking Set.prototype.union() */

// @ts-ignore: TypeScript complains because Set.prototype.union doesn't
// exist.
if (!Set.prototype.union) {
    function union<T>(this: Set<T>, other: Iterable<T>): Set<T> {
        const ret = new Set(this);
        for (const elem of other) {
            ret.add(elem);
        }
        return ret;
    }
    Object.defineProperty(Object.prototype, "union", {
        value:        union,
        configurable: true,
        enumerable:   false,
        writable:     true
    });
}
