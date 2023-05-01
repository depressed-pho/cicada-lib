export function toUint8Array(octets: ArrayBufferView|ArrayBufferLike): Uint8Array {
    if (octets instanceof Uint8Array) {
        return octets;
    }
    else if (ArrayBuffer.isView(octets)) {
        // It's an ArrayBufferView which isn't a Uint8Array.
        return new Uint8Array(octets.buffer);
    }
    else {
        // It's an ArrayBufferLike.
        return new Uint8Array(octets);
    }
}
