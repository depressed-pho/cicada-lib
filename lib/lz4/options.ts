export enum LZ4MaximumBlockSize {
    MAX_64_KIB  =       64 * 1024,
    MAX_256_KIB =      256 * 1024,
    MAX_1_MIB   =     1024 * 1024,
    MAX_4_MIB   = 4 * 1024 * 1024
}

export interface LZ4Dictionary {
    /// 32-bits unsigned integer identifying the dictionary.
    id: number;

    /// Data of any length, but only the last 64 KiB of it will be used.
    data: ArrayBufferView|ArrayBufferLike;
}

export interface LZ4CompressionOptions {
    /** Set this to true if you want data blocks to be independent of each
     * other at the cost of decreased compression ratio. Defaults to
     * `false`. */
    independentBlocks?: boolean;

    /** Set this to true if you want each data block to be followed by a
     * 4-octets checksum. Trying to decompress corrupted data will fail
     * before reaching the end of the stream. Defaults to `false`.
     */
    blockChecksums?: boolean;

    /** Set this to the number of octets in the uncompressed data, if you
     * want it to be recorded in the LZ4 frame header. Defaults to
     * `undefined`. */
    contentSize?: number|undefined;

    /** Set this to true if you want to store the checksum of the
     * uncompressed data. Storing it costs 4 octets but it makes it
     * possible to detect corrupted data. Defaults to `true`. */
    contentChecksum?: boolean;

    /** Use a predefined dictionary for compression. Defaults to
     * `undefined`. */
    dictionary?: LZ4Dictionary|undefined;

    /** The maximum size of each data block. Larger blocks may yield better
     * compression ratio but decompressors may consume more
     * memory. Defaults to 4 MiB. */
    maximumBlockSize?: LZ4MaximumBlockSize;

    /** The size of hash table for finding matches. Larger hash tables
     * yield better compression ratio but the compressor consumes more
     * memory. Defaults to 16. */
    hashBits?: number;

    /** `2^skipTrigger` non-matching octets before starting to skip data
     * over. Smaller values makes compression faster but produce longer
     * results. Defaults to 6. */
    skipTrigger?: number;
}

export interface LZ4DecompressionOptions {
    /** Callback function to resolve a dictionary for a given dictionary
     * ID. Returning `undefined` means that no corresponding dictionary is
     * available. */
    resolveDictionary?: (id: number) => ArrayBufferView|ArrayBufferLike|undefined;
}
