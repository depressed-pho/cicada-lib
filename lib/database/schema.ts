import { Parser } from "../parser.js";
import * as P from "../parser.js";
import * as PB from "./metadata_pb.js";

export interface IDatabaseSchema {
    [table: string]: string;
}

export type KeyPath = string[];

interface IIndexModifiers {
    readonly isUnique: boolean;
    readonly isMulti: boolean;
}

export function equalKeyPaths(a: KeyPath, b: KeyPath): boolean {
    if (a.length !== b.length) {
        return false;
    }
    else {
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i])
                return false;
        }
        return true;
    }
}

export function parseKeyPath(keyPath: string): KeyPath {
    return P.getResult(P.parse(keyPathP, keyPath));
}

// It's a JavaScript identifier but doesn't currently allow escape
// sequences or zero-width characters.
const keyP: Parser<string> =
    P.match(/[\p{ID_Start}$_]/u).then(start =>
        P.takeWhile(c => /[\p{ID_Continue}$]/u.test(c)).then(cont =>
            P.pure(start + cont)));

const keyPathP: Parser<KeyPath> =
    P.sepBy1(keyP, P.literal("."));

const compoundKeyP: Parser<KeyPath[]> =
    P.literal("[").then(() =>
        P.sepBy1(
            P.skipAsciiSpaces.then(() => keyPathP),
            P.skipAsciiSpaces.then(() => P.literal("+"))).then(keyPaths => {
                if (keyPaths.length < 2)
                    return P.fail("A compound index must not be a singleton");
                else
                    return P.skipAsciiSpaces.then(() =>
                        P.literal("]").then(() =>
                            P.pure(keyPaths)));
            }));

const primaryKeyP: Parser<PrimaryKey> =
    P.choice([
        // Compound primary key
        compoundKeyP.then(keyPaths =>
            P.pure(
                new PrimaryKey(
                    false,
                    new Index(keyPaths, {isUnique: true, isMulti: false})))),
        // Non-compound primary key
        P.option(false, P.literal("++").map(() => true)).then(isAutoIncr =>
            P.skipAsciiSpaces.then(() =>
                P.option([], keyPathP.map(kp => [kp])).then(keyPaths =>
                    P.pure(
                        new PrimaryKey(
                            isAutoIncr,
                            new Index(keyPaths, {isUnique: true, isMulti: false}))))))
    ]);

const modsP: Parser<IIndexModifiers> =
    P.choice<IIndexModifiers>([
        P.literal("&").then(() =>
            P.skipAsciiSpaces.then(() =>
                P.option(false, P.literal("*").map(() => true)).then(isMulti =>
                    P.pure({isUnique: true, isMulti})))),
        P.literal("*").then(() =>
            P.skipAsciiSpaces.then(() =>
                P.option(false, P.literal("&").map(() => true)).then(isUnique =>
                    P.pure({isUnique, isMulti: true})))),
        P.pure({isUnique: false, isMulti: false})
    ]);

const indicesP: Parser<Indices> =
    primaryKeyP.then(pKey =>
        P.many(P.skipAsciiSpaces.then(() =>
            P.literal(",").then(() =>
                P.skipAsciiSpaces.then(() =>
                    P.choice([
                        // Compound index
                        P.option(false, P.literal("&").map(() => true)).then(isUnique =>
                            P.skipAsciiSpaces.then(() =>
                                compoundKeyP.then(keyPaths =>
                                    P.pure(
                                        new Index(keyPaths, {isUnique, isMulti: false}))))),
                        // Non-compound index
                        modsP.then(mods =>
                            P.skipAsciiSpaces.then(() =>
                                keyPathP.then(kp =>
                                    P.pure(new Index([kp], mods)))))
                    ]))))).then(indices =>
                        P.pure(new Indices(pKey, new Set(indices)))));

/// @internal
export class Indices {
    readonly pKey: PrimaryKey;
    readonly indices: Set<Index>;

    public constructor(indices: string);
    public constructor(obj: PB.Indices);
    public constructor(pKey: PrimaryKey, indices: Set<Index>);
    public constructor(...args: any[]) {
        if (args.length === 1) {
            if (typeof args[0] === "string") {
                const ids = P.getResult(P.parse(indicesP, args[0]));
                this.pKey    = ids.pKey;
                this.indices = ids.indices;
            }
            else {
                const obj: PB.Indices = args[0];
                this.pKey    = new PrimaryKey(obj.pKey!);
                this.indices = new Set<Index>(obj.indices.map(idx => new Index(idx)));
            }
        }
        else {
            this.pKey    = args[0];
            this.indices = args[1];
        }
    }

    public toMessage(): PB.Indices {
        return {
            pKey:    this.pKey.toMessage(),
            indices: Array.from(this.indices).map(idx => idx.toMessage())
        };
    }
}

/// Package private: user code should not use this.
export class PrimaryKey {
    readonly isAutoIncr: boolean;
    readonly index: Index;

    public constructor(obj: PB.PrimaryKey);
    public constructor(isAutoIncr: boolean, index: Index);
    public constructor(...args: any[]) {
        if (args.length === 1) {
            const obj: PB.PrimaryKey = args[0];
            this.isAutoIncr = obj.isAutoIncr;
            this.index      = new Index(obj.index!);
        }
        else {
            this.isAutoIncr = args[0];
            this.index      = args[1];
        }
    }

    public toMessage(): PB.PrimaryKey {
        return {
            isAutoIncr: this.isAutoIncr,
            index:      this.index.toMessage()
        };
    }
}

// Package private: user code should not use this.
export class Index {
    readonly keyPaths: KeyPath[];
    readonly isUnique: boolean;
    readonly isMulti: boolean;

    public constructor(obj: PB.Index);
    public constructor(keyPaths: KeyPath[], mods: IIndexModifiers);
    public constructor(...args: any[]) {
        if (args.length === 1) {
            const obj: PB.Index = args[0];
            this.keyPaths = obj.keyPaths.map(kp => kp.split("."));
            this.isUnique = obj.isUnique;
            this.isMulti  = obj.isMulti;
        }
        else {
            this.keyPaths = args[0];
            this.isUnique = args[1].isUnique;
            this.isMulti  = args[1].isMulti;
        }
    }

    public toMessage(): PB.Index {
        return {
            keyPaths: this.keyPaths.map(kp => kp.join(".")),
            isUnique: this.isUnique,
            isMulti:  this.isMulti
        }
    }
}
