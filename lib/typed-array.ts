export function toUint8Array(octets: ArrayBufferView|ArrayBufferLike): Uint8Array {
    if (octets instanceof Uint8Array) {
        return octets;
    }
    else if (ArrayBuffer.isView(octets)) {
        // It's an ArrayBufferView which isn't a Uint8Array. Consider the
        // case where its underlying buffer is larger than the view.
        return new Uint8Array(octets.buffer, octets.byteOffset, octets.byteLength);
    }
    else {
        // It's an ArrayBufferLike.
        return new Uint8Array(octets);
    }
}

export function toDataView(octets: ArrayBufferView|ArrayBufferLike): DataView {
    if (octets instanceof DataView) {
        return octets;
    }
    else if (ArrayBuffer.isView(octets)) {
        // It's an ArrayBufferView which isn't a DataView. Consider the
        // case where its underlying buffer is larger than the view.
        return new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
    }
    else {
        // It's an ArrayBufferLike.
        return new DataView(octets);
    }
}
