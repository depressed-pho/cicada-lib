import { LZ4MaximumBlockSize, LZ4Dictionary } from "./options.js";
import { xxHash32 } from "../xxh32.js";

export interface LZ4FrameDescriptor {
    independentBlocks: boolean;
    blockChecksums:    boolean;
    contentSize:       number|undefined;
    contentChecksum:   boolean;
    dictionary:        LZ4Dictionary|undefined;
    maximumBlockSize:  LZ4MaximumBlockSize;
}

export const MAX_FRAME_DESCRIPTOR_LENGTH = 15;

function toMaxBlockSizeDesc(sz: LZ4MaximumBlockSize) {
    switch (sz) {
        case       64 * 1024: return 4;
        case      256 * 1024: return 5;
        case     1024 * 1024: return 6;
        case 4 * 1024 * 1024: return 7;
        default:
            throw new RangeError(`Unknown max block size: ${sz}`);
    }
}

/// Write a frame descriptor at a given offset. Returns new offset.
export function writeFrameDescriptor(buf: ArrayBuffer, offset: number, desc: LZ4FrameDescriptor): number {
    const len =
        1 + // FLG
        1 + // BD
        (desc.contentSize === undefined ? 0 : 8) +
        (desc.dictionary  === undefined ? 0 : 4) +
        1;  // HC
    if (buf.byteLength < offset + len) {
        throw new RangeError("Output buffer is too small to put a frame descriptor");
    }
    const frameStart = offset;
    const view       = new DataView(buf);

    // FLG
    view.setUint8(
        offset,
        ( (1                                        << 6) | // version
          ((desc.independentBlocks         ? 1 : 0) << 5) |
          ((desc.blockChecksums            ? 1 : 0) << 4) |
          ((desc.contentSize !== undefined ? 1 : 0) << 3) |
          ((desc.contentChecksum           ? 1 : 0) << 2) |
          ((desc.dictionary  !== undefined ? 1 : 0)     ) ));
    offset++;

    // BD
    view.setUint8(offset, (toMaxBlockSizeDesc(desc.maximumBlockSize) & 0b111) << 4);
    offset++;

    if (desc.contentSize !== undefined) {
        if (desc.contentSize <= 0xFFFFFFFF) {
            view.setUint32(offset  , desc.contentSize, true);
            view.setUint32(offset+4, 0               , true);
            offset += 8;
        }
        else {
            // This requires BigInt, but QuickJS doesn't support it.
            throw new RangeError(`64-bit contentSize is currently not supported: ${desc.contentSize}`);
        }
    }

    if (desc.dictionary !== undefined) {
        view.setUint32(offset, desc.dictionary.id & 0xFFFFFFFF, true);
        offset += 4;
    }

    // HC
    const digest = xxHash32(new Uint8Array(buf, frameStart, len - 1));
    view.setUint8(offset, (digest >> 8) & 0xFF);
    offset++;

    return offset;
}
