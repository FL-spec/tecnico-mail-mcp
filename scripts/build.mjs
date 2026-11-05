// Builds two artifacts from src/index.ts:
//   dist/index.js              for npm, with dependencies left to the package manager
//   dist/mcpb/server/index.js  for the Claude Desktop extension, with everything bundled
import { chmod, mkdir, readFile } from "node:fs/promises";
import { build } from "esbuild";

const { version } = JSON.parse(await readFile("package.json", "utf8"));
const shared = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  legalComments: "inline",
  define: { __VERSION__: JSON.stringify(version) },
};

await mkdir("dist", { recursive: true });
await build({
  ...shared,
  outfile: "dist/index.js",
  packages: "external",
  banner: { js: "#!/usr/bin/env node" },
});
await chmod("dist/index.js", 0o755);

// Some bundled CommonJS dependencies call require(); ESM has no global require, so provide one.
// The keyring is a native module and stays out: the extension's keychain is Claude Desktop's own.
await build({
  ...shared,
  outfile: "dist/mcpb/server/index.js",
  external: ["@napi-rs/keyring"],
  banner: {
    js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);',
  },
});
