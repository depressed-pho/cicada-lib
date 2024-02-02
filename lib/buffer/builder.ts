import { Buffer } from "../buffer.js";

export type Op = (buf: Buffer) => void;

export class Builder {
    readonly #ops: Op[];

    public constructor() {
        this.#ops = [];
    }

    public append(op: Op): this {
        this.#ops.push(op);
        return this;
    }

    public toBuffer(): Buffer {
        const buf = new Buffer();
        for (const op of this.#ops)
            op(buf);
        return buf;
    }
}

export const empty: Op =
    _ => {};

export function putBuffer(buf: Buffer): Op {
    return buf0 => buf0.append(buf);
}

export function putUint32(n: number, littleEndian: boolean): Op {
    return buf => buf.appendUint32(n, littleEndian);
}
