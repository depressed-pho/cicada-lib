import { Tag, Doc } from "./primitives.js";

/** Display a document with obfuscation. */
export function obfuscate(d: Doc): Doc {
    return {
        tag:     Tag.Obfuscate,
        enabled: true,
        doc:     d
    };
}

/** Display a document without obfuscation. */
export function deobfuscate(d: Doc): Doc {
    return {
        tag:     Tag.Obfuscate,
        enabled: false,
        doc:     d
    };
}

/** Display a document in a heavier font weight. */
export function bold(d: Doc): Doc {
    return {
        tag:     Tag.Bold,
        enabled: true,
        doc:     d
    };
}

/** Display a document in the normal font weight. */
export function debold(d: Doc): Doc {
    return {
        tag:     Tag.Bold,
        enabled: false,
        doc:     d
    };
}

/** Display a document with strikethrough. This has currently no effects on
 * Bedrock. */
export function strikethrough(d: Doc): Doc {
    return {
        tag:     Tag.Strikethrough,
        enabled: true,
        doc:     d
    };
}

/** Display a document without strikethrough. */
export function unstrikethrough(d: Doc): Doc {
    return {
        tag:     Tag.Strikethrough,
        enabled: false,
        doc:     d
    };
}

/** Display a document with underlining. This has currently no effects on
 * Bedrock. */
export function underline(d: Doc): Doc {
    return {
        tag:     Tag.Underline,
        enabled: true,
        doc:     d
    };
}

/** Display a document without underlining. */
export function deunderline(d: Doc): Doc {
    return {
        tag:     Tag.Underline,
        enabled: false,
        doc:     d
    };
}

/** Display a document in italics. */
export function italicise(d: Doc): Doc {
    return {
        tag:     Tag.Italicise,
        enabled: true,
        doc:     d
    };
}

/** Display a document without italics. */
export function deitalicise(d: Doc): Doc {
    return {
        tag:     Tag.Italicise,
        enabled: false,
        doc:     d
    };
}
