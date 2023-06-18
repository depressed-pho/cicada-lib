import { lazy } from "./lazy.js";

const RE_UUID = /^([0-9a-fA-F]{8})-([0-9a-fA-F]{4})-([0-9a-fA-F]{4})-([0-9a-fA-F]{4})-([0-9a-fA-F]{4})([0-9a-fA-F]{8})$/;
const GREG_POSIX_MS_DELTA = 12219292800000;
const BYTE_TO_HEX = lazy(() => {
    const arr = [];
    for (let i = 0; i < 0x100; i++) {
        arr.push((i + 0x100).toString(16).slice(1));
    }
    return arr;
});

/* RFC 4122 Universally Unique Identifier */
export class UUID {
    #timeLow:               number = 0; // 4 octets
    #timeMid:               number = 0; // 2 octets
    #timeHiAndVersion:      number = 0; // 2 octets
    #clockSeqHiAndReserved: number = 0; // 1 octet
    #clockSeqLow:           number = 0; // 1 octet
    #nodeHi:                number = 0; // 2 octets; split because we can't do 64-bits arithmetics
    #nodeLo:                number = 0; // 4 octets

    static #lastMS:       number = 0;
    static #lastNS:       number = 0;
    static #lastClockSeq: number = Math.floor(Math.random() *     0x3FFF);
    static #v1NodeHi:     number = Math.floor(Math.random() *     0xFFFF);
    static #v1NodeLo:     number = Math.floor(Math.random() * 0xFFFFFFFF);

    /** Construct a nil UUID. */
    protected constructor() {}

    /** Construct a UUID object by parsing a UUID string. */
    public static parse(str: string): UUID;

    /** Construct a UUID object by parsing big-endian UUID octets. */
    public static parse(bin: Uint8Array): UUID;

    public static parse(arg: string|Uint8Array): UUID {
        if (typeof arg === "string") {
            const m = RE_UUID.exec(arg);
            if (m) {
                const uuid = new UUID();
                uuid.#timeLow               = Number.parseInt(m[1]!, 16);
                uuid.#timeMid               = Number.parseInt(m[2]!, 16);
                uuid.#timeHiAndVersion      = Number.parseInt(m[3]!, 16);
                uuid.#clockSeqHiAndReserved = Number.parseInt(m[4]!.slice(0, 2), 16);
                uuid.#clockSeqLow           = Number.parseInt(m[4]!.slice(2   ), 16);
                uuid.#nodeHi                = Number.parseInt(m[5]!, 16);
                uuid.#nodeLo                = Number.parseInt(m[6]!, 16);
                return uuid;
            }
            else {
                throw new TypeError(`Unparsable UUID: ${arg}`);
            }
        }
        else {
            if (arg.length === 16) {
                const v    = new DataView(arg.buffer, arg.byteOffset, arg.byteLength);
                const uuid = new UUID();
                uuid.#timeLow               = v.getUint32(0);
                uuid.#timeMid               = v.getUint16(4);
                uuid.#timeHiAndVersion      = v.getUint16(6);
                uuid.#clockSeqHiAndReserved = v.getUint8(8);
                uuid.#clockSeqLow           = v.getUint8(9);
                uuid.#nodeHi                = v.getUint16(10);
                uuid.#nodeLo                = v.getUint32(12);
                return uuid;
            }
            else {
                throw new TypeError(`Unparsable UUID: ${arg}`);
            }
        }
    }

    /** Construct a Nil UUID. */
    public static nil(): UUID {
        return new UUID();
    }

    /** Construct a version 1 time-based UUID. */
    public static v1(): UUID {
        // UUID timestamps are 100 nanosecond units since the Gregorian
        // epoch (1582-10-15T00:00:00Z) but we don't have a clock precise
        // enough for this. So for the nanoseconds part we use a counter
        // starting with zero and increment it every time we generate a new
        // v1 UUID.
        const ms = Date.now() + GREG_POSIX_MS_DELTA;
        const ns = ms === UUID.#lastMS ? UUID.#lastNS + 1 : 0;
        if (ns >= 10000) {
            throw new Error("Can't create more than 10M v1 UUID per second.");
        }

        let clockSeq = UUID.#lastClockSeq;
        if (ms < UUID.#lastMS) {
            // Bump the clock sequence on clock regression.
            clockSeq = (clockSeq + 1) & 0x3FFF;
        }

        // THINKME: Maybe we should save these values in the world? We
        // could only do that after the world initialisation though.
        UUID.#lastMS       = ms;
        UUID.#lastNS       = ns;
        UUID.#lastClockSeq = clockSeq;

        const timeLow   = ((ms & 0xFFFFFFF) * 10000 + ns) % 0x100000000;
        const timeHiMid = ((ms / 0x100000000) * 10000) & 0xFFFFFFF;

        const uuid = new UUID();
        uuid.#timeLow               = timeLow;
        uuid.#timeMid               =   timeHiMid        & 0xFFFF;
        uuid.#timeHiAndVersion      = ((timeHiMid >> 16) & 0xFFFF) | 0x1000;
        uuid.#clockSeqHiAndReserved = ((clockSeq  >>  8) &   0xFF) |   0x80;
        uuid.#clockSeqLow           = ( clockSeq         &   0xFF);
        uuid.#nodeHi                = UUID.#v1NodeHi;
        uuid.#nodeLo                = UUID.#v1NodeLo;
        return uuid;
    }

    // FIXME: Implement v3 (MD5) and v5 (SHA-1) name-based UUIDs.

    /** Construct a version 4 pseudo-random UUID. Note that this isn't
     * cryptographically secure. Do not use this for anything related to
     * security. */
    public static v4(): UUID {
        const uuid = new UUID();
        uuid.#timeLow               = Math.floor(Math.random() * 0xFFFFFFFF);
        uuid.#timeMid               = Math.floor(Math.random() *     0xFFFF);
        uuid.#timeHiAndVersion      = Math.floor(Math.random() *     0x0FFF) | 0x4000;
        uuid.#clockSeqHiAndReserved = Math.floor(Math.random() *       0x3F) |   0x80;
        uuid.#clockSeqLow           = Math.floor(Math.random() *       0xFF);
        uuid.#nodeHi                = Math.floor(Math.random() *     0xFFFF);
        uuid.#nodeLo                = Math.floor(Math.random() * 0xFFFFFFFF);
        return uuid;
    }

    /** Turn a UUID into a string. */
    public toString(): string {
        return [
            BYTE_TO_HEX[(this.#timeLow               >>> 24) & 0xFF],
            BYTE_TO_HEX[(this.#timeLow               >>> 16) & 0xFF],
            BYTE_TO_HEX[(this.#timeLow               >>>  8) & 0xFF],
            BYTE_TO_HEX[ this.#timeLow                       & 0xFF],
            "-",
            BYTE_TO_HEX[(this.#timeMid               >>>  8) & 0xFF],
            BYTE_TO_HEX[ this.#timeMid                       & 0xFF],
            "-",
            BYTE_TO_HEX[(this.#timeHiAndVersion      >>>  8) & 0xFF],
            BYTE_TO_HEX[ this.#timeHiAndVersion              & 0xFF],
            "-",
            BYTE_TO_HEX[ this.#clockSeqHiAndReserved         & 0xFF],
            BYTE_TO_HEX[ this.#clockSeqLow                   & 0xFF],
            "-",
            BYTE_TO_HEX[(this.#nodeHi                >>>  8) & 0xFF],
            BYTE_TO_HEX[ this.#nodeHi                        & 0xFF],
            BYTE_TO_HEX[(this.#nodeLo                >>> 24) & 0xFF],
            BYTE_TO_HEX[(this.#nodeLo                >>> 16) & 0xFF],
            BYTE_TO_HEX[(this.#nodeLo                >>>  8) & 0xFF],
            BYTE_TO_HEX[ this.#nodeLo                        & 0xFF]
        ].join("");
    }

    /** Turn a UUID into big-endian octets. */
    public toOctets(): Uint8Array {
        const u8 = new Uint8Array(16);
        const v  = new DataView(u8.buffer);
        v.setUint32(0, this.#timeLow);
        v.setUint16(4, this.#timeMid);
        v.setUint16(6, this.#timeHiAndVersion);
        v.setUint8(8, this.#clockSeqHiAndReserved);
        v.setUint8(9, this.#clockSeqLow);
        v.setUint16(10, this.#nodeHi);
        v.setUint32(12, this.#nodeLo);
        return u8;
    }
}
