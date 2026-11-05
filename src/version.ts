declare const __VERSION__: string | undefined;

/** Injected at build time. Tests run from source, where the constant does not exist. */
export const VERSION = typeof __VERSION__ === "string" ? __VERSION__ : "0.0.0-dev";
