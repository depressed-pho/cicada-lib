import { Buffer, Conduit, PrematureEOF, conduit, peekE, sinkBuffer, takeE,
         yieldC
       } from "../stream.js";
import { LZ4MaximumBlockSize } from "./options.js";
import { xxHash32 } from "../xxhash.js";

export interface LZ4FrameDescriptor {
    independentBlocks: boolean;
    blockChecksums:    boolean;
    contentSize:       number|undefined;
    contentChecksum:   boolean;
    dictionaryID:      number|undefined;
    maximumBlockSize:  LZ4MaximumBlockSize;
}

const MAX_FRAME_DESCRIPTOR_LENGTH = 15;

function toMaxBlockSizeDesc(sz: LZ4MaximumBlockSize) {
    switch (sz) {
        case LZ4MaximumBlockSize.MAX_64_KIB:  return 4;
        case LZ4MaximumBlockSize.MAX_256_KIB: return 5;
        case LZ4MaximumBlockSize.MAX_1_MIB:   return 6;
        case LZ4MaximumBlockSize.MAX_4_MIB:   return 7;
        default:
            throw new RangeError(`Unknown max block size: ${sz}`);
    }
}

function fromMaxBlockSizeDesc(sz: number) {
    switch (sz) {
        case 4: return LZ4MaximumBlockSize.MAX_64_KIB;
        case 5: return LZ4MaximumBlockSize.MAX_256_KIB;
        case 6: return LZ4MaximumBlockSize.MAX_1_MIB;
        case 7: return LZ4MaximumBlockSize.MAX_4_MIB;
        default:
            throw new RangeError(`Unknown max block size: ${sz}`);
    }
}

/// Write a frame descriptor to the stream.
export function writeFrameDescriptor(desc: LZ4FrameDescriptor): Conduit<unknown, Buffer, void> {
    return conduit(function* () {
        const buf = new Buffer();
        buf.reserve(MAX_FRAME_DESCRIPTOR_LENGTH - 1 /* HC */);

        // FLG
        buf.appendUint8(
            (1                                         << 6) | // version
                ((desc.independentBlocks          ? 1 : 0) << 5) |
                ((desc.blockChecksums             ? 1 : 0) << 4) |
                ((desc.contentSize  !== undefined ? 1 : 0) << 3) |
                ((desc.contentChecksum            ? 1 : 0) << 2) |
                ((desc.dictionaryID !== undefined ? 1 : 0)     ) );

        // BD
        buf.appendUint8((toMaxBlockSizeDesc(desc.maximumBlockSize) & 0b111) << 4);

        if (desc.contentSize !== undefined) {
            if (desc.contentSize <= 0xFFFFFFFF) {
                buf.appendUint32(desc.contentSize, true);
                buf.appendUint32(0               , true);
            }
            else {
                // This requires BigInt, but QuickJS doesn't support it.
                throw new RangeError(`64-bit contentSize is currently not supported: ${desc.contentSize}`);
            }
        }

        if (desc.dictionaryID !== undefined) {
            buf.appendUint32(desc.dictionaryID, true);
        }

        // HC
        const digest = xxHash32(buf);
        buf.appendUint8((digest >> 8) & 0xFF);

        yield* yieldC(buf);
    });
}

/// Read a frame descriptor from a stream.
export const readFrameDescriptor /* : Conduit<Buffer, never, LZ4FrameDescriptor> */ =
    conduit(function* () {
        // The length of the frame descriptor can only be determined after
        // reading the FLG byte.
        const flg = yield* peekE;
        if (flg === undefined)
            throw new PrematureEOF("Premature end of stream while reading a frame descriptor");

        const version = (flg & (0b11 << 6)) >>> 6;
        if (version != 1)
            throw new Error(`Unknown frame descriptor version: ${version}`);

        const desc: Partial<LZ4FrameDescriptor> = {
            independentBlocks: (flg & (1 << 5)) != 0,
            blockChecksums:    (flg & (1 << 4)) != 0,
            contentChecksum:   (flg & (1 << 2)) != 0
        };
        const length =
            1 + // FLG
            1 + // BD
            (desc.contentSize  === undefined ? 0 : 8) +
            (desc.dictionaryID === undefined ? 0 : 4) +
            1;  // HC
        const buf = yield* takeE(length).fuse(sinkBuffer);
        if (buf.length < length)
            throw new PrematureEOF("Premature end of stream while reading a frame descriptor");

        let offset = 1; // because we've already read the FLG.
        const bd = buf.getUint8(offset); offset++;
        desc.maximumBlockSize = fromMaxBlockSizeDesc((bd & (0b111 << 4)) >>> 4);

        if ((flg & (1 << 3)) != 0) {
            const sizeLo = buf.getUint32(offset, true); offset += 4;
            const sizeHi = buf.getUint32(offset, true); offset += 4;

            if (sizeHi > 0) {
                // This requires BigInt, but QuickJS doesn't support it.
                throw new RangeError("64-bit contentSize is currently not supported");
            }
            desc.contentSize = sizeLo;
        }

        if ((flg & (1 << 0)) != 0) {
            desc.dictionaryID = buf.getUint32(offset, true); offset += 4;
        }

        // HC
        const expectedSum = buf.getUint8(offset);
        const actualSum   = (xxHash32(buf.unsafeSubBuffer(0, -1)) >> 8) & 0xFF;
        if (expectedSum != actualSum) {
            throw new Error(
                `Header checksum mismatches: expected ${expectedSum.toString(16)}, got ${actualSum.toString(16)}`);
        }

        return desc as LZ4FrameDescriptor;
    });
