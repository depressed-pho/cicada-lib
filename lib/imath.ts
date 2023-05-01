/** Unsigned 32-bit modular multiplication. For arguments `x` and `y`, this
 * function computes `x + y mod 2^32` while `x` and `y` both being coerced
 * into u32.
 */
export function umul32(x: number, y: number): number {
    const x_hi = x >>> 16;
    const x_lo = x & 0xFFFF;
    const y_hi = y >>> 16;
    const y_lo = y & 0xFFFF;

    return x_lo * y_lo + (x_hi * y_lo + x_lo * y_hi << 16) | 0;
}

/** Unsigned 32-bit left bit rotation. */
export function urotl32(x: number, r: number): number {
    return x >>> (32 - r | 0) | x << r;
}
