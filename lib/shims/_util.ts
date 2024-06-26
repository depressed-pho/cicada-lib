/** Install a property to globalThis. Not intended for direct use. */
export function installGlobal(name: PropertyKey, value: any, opts?: InstallationOptions): void {
    if (name in globalThis && !opts?.overwrite) {
        // It already exists.
    }
    else {
        if (!("cicada-lib" in globalThis)) {
            (globalThis as any)["cicada-lib"] = {};
        }
        if (!("shims" in (globalThis as any)["cicada-lib"])) {
            (globalThis as any)["cicada-lib"]["shims"] = new Set<string>();
        }
        if (!(globalThis as any)["cicada-lib"]["shims"].has(name)) {
            // Even if opts.overwrite is enabled we don't want to overwrite
            // things we installed ourselves.
            Object.defineProperty(globalThis, name, {
                value,
                configurable: true,
                enumerable:   false,
                writable:     true
            });
            (globalThis as any)["cicada-lib"]["shims"].add(name);
        }
    }
}

export interface InstallationOptions {
    /** Install the shim even if the corresponding feature exists. */
    overwrite?: boolean;
}
