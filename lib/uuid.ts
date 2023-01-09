import { lazy } from "./lazy.js";

const RE_UUID = /^([0-9a-fA-F]{8})-([0-9a-fA-F]{4})-([0-9a-fA-F]{4})-([0-9a-fA-F]{4})-([0-9a-fA-F]{12})$/;
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
    #node:                  number = 0; // 6 octets

    static #lastMS:       number = 0;
    static #lastNS:       number = 0;
    static #lastClockSeq: number = Math.floor(Math.random() *         0x3FFF);
    static #v1node:       number = Math.floor(Math.random() * 0xFFFFFFFFFFFF);

    /** Construct a nil UUID. */
    protected constructor() {}

    /** Construct a UUID object by parsing a UUID string. */
    public static parse(str: string): UUID {
        const m = RE_UUID.exec(str);
        if (m) {
            const uuid = new UUID();
            uuid.#timeLow               = Number.parseInt(m[1]!, 16);
            uuid.#timeMid               = Number.parseInt(m[2]!, 16);
            uuid.#timeHiAndVersion      = Number.parseInt(m[3]!, 16);
            uuid.#clockSeqHiAndReserved = Number.parseInt(m[4]!.slice(0, 2), 16);
            uuid.#clockSeqLow           = Number.parseInt(m[4]!.slice(2   ), 16);
            uuid.#node                  = Number.parseInt(m[5]!, 16);
            return uuid;
        }
        else {
            throw new TypeError(`Unparsable UUID: ${str}`);
        }
    }

    /** Construct an Nil UUID. */
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
        uuid.#node                  = UUID.#v1node;
        return uuid;
    }

    // FIXME: Implement v3 (MD5) and v5 (SHA-1) name-based UUIDs.

    /** Construct a version 4 pseudo-random UUID. Note that this isn't
     * cryptographically secure. Do not use this for anything related to
     * security. */
    public static v4(): UUID {
        const uuid = new UUID();
        uuid.#timeLow               = Math.floor(Math.random() *     0xFFFFFFFF);
        uuid.#timeMid               = Math.floor(Math.random() *         0xFFFF);
        uuid.#timeHiAndVersion      = Math.floor(Math.random() *         0x0FFF) | 0x4000;
        uuid.#clockSeqHiAndReserved = Math.floor(Math.random() *           0x3F) |   0x80;
        uuid.#clockSeqLow           = Math.floor(Math.random() *           0xFF);
        uuid.#node                  = Math.floor(Math.random() * 0xFFFFFFFFFFFF);
        return uuid;
    }

    public toString(): string {
        return [
            BYTE_TO_HEX[(this.#timeLow               >> 24) & 0xFF],
            BYTE_TO_HEX[(this.#timeLow               >> 16) & 0xFF],
            BYTE_TO_HEX[(this.#timeLow               >>  8) & 0xFF],
            BYTE_TO_HEX[ this.#timeLow                      & 0xFF],
            "-",
            BYTE_TO_HEX[(this.#timeMid               >>  8) & 0xFF],
            BYTE_TO_HEX[ this.#timeMid                      & 0xFF],
            "-",
            BYTE_TO_HEX[(this.#timeHiAndVersion      >>  8) & 0xFF],
            BYTE_TO_HEX[ this.#timeHiAndVersion             & 0xFF],
            "-",
            BYTE_TO_HEX[ this.#clockSeqHiAndReserved        & 0xFF],
            BYTE_TO_HEX[ this.#clockSeqLow                  & 0xFF],
            "-",
            BYTE_TO_HEX[(this.#node                  >> 40) & 0xFF],
            BYTE_TO_HEX[(this.#node                  >> 32) & 0xFF],
            BYTE_TO_HEX[(this.#node                  >> 24) & 0xFF],
            BYTE_TO_HEX[(this.#node                  >> 16) & 0xFF],
            BYTE_TO_HEX[(this.#node                  >>  8) & 0xFF],
            BYTE_TO_HEX[ this.#node                         & 0xFF]
        ].join("");
    }
}
