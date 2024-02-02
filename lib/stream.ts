export * from "./stream/buffer.js";
export * from "./stream/conduit.js";
export * from "./stream/conduit/combinators.js";

export class PrematureEOF extends Error {
    public constructor(...args: ConstructorParameters<typeof Error>) {
        super(...args);
    }
}
