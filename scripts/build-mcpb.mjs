// Packs dist/tecnico-mail.mcpb from the bundled server. Run `npm run build` first.
import { execFileSync } from "node:child_process";
import { copyFile, readFile, writeFile } from "node:fs/promises";

const { version } = JSON.parse(await readFile("package.json", "utf8"));
const manifest = JSON.parse(await readFile("mcpb/manifest.json", "utf8"));
await writeFile("dist/mcpb/manifest.json", JSON.stringify({ ...manifest, version }, null, 2));
await copyFile("mcpb/icon.png", "dist/mcpb/icon.png");
await copyFile("LICENSE", "dist/mcpb/LICENSE");

const mcpb = (...args) => execFileSync("npx", ["mcpb", ...args], { stdio: "inherit" });
mcpb("validate", "dist/mcpb/manifest.json");
mcpb("pack", "dist/mcpb", "dist/tecnico-mail.mcpb");
