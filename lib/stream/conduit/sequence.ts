import { Buffer } from "../buffer.js";

/// Poor man's type class. LOL.

export function length(seq: string): number;
export function length<T>(seq: T[]): number;
export function length(seq: Uint8Array): number;
export function length(seq: Buffer): number;
export function length(seq: any): number {
    if (typeof seq === "string" || Array.isArray(seq))
        return seq.length;
    else if (seq instanceof Uint8Array)
        return seq.byteLength;
    else if (seq instanceof Buffer)
        return seq.length;
    else
        throw new TypeError(`${seq} does not have length`);
}

export function subarray(seq: string, start: number, end?: number): string;
export function subarray<T>(seq: T[], start: number, end?: number): T[];
export function subarray(seq: Uint8Array, start: number, end?: number): Uint8Array;
export function subarray(seq: Buffer, start: number, end?: number): Buffer;
export function subarray(seq: any, start: number, end?: number) {
    if (typeof seq === "string" || Array.isArray(seq))
        return seq.slice(start, end);
    else if (seq instanceof Uint8Array)
        return seq.subarray(start, end);
    else if (seq instanceof Buffer)
        return seq.unsafeSubBuffer(start, end);
    else
        throw new TypeError(`${seq} is not sliceable`);
}

export function head(seq: string): string|undefined;
export function head<T>(seq: T[]): T|undefined;
export function head(seq: Uint8Array): number|undefined;
export function head(seq: Buffer): number|undefined;
export function head(seq: any) {
    if (typeof seq === "string" || Array.isArray(seq) || seq instanceof Uint8Array) {
        return seq[0];
    }
    else if (seq instanceof Buffer) {
        for (const o of seq)
            return o;
        return undefined;
    }
    else {
        throw new TypeError(`${seq} isn't a sequence`);
    }
}
