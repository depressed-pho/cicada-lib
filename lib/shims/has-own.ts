/** For JavaScript implementations lacking Object.hasOwn() */

if (!Object.hasOwn) {
    function hasOwn(obj: any, key: PropertyKey): boolean {
        if (obj == null) {
            throw new TypeError("Cannot convert undefined or null to object");
        }
        return Object.prototype.hasOwnProperty.call(Object(obj), key);
    }
    Object.defineProperty(Object, "hasOwn", {
        value:        hasOwn,
        configurable: true,
        enumerable:   false,
        writable:     true
    });
}
