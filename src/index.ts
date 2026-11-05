import { parseArgs } from "node:util";
import { defaultDependencies, doctor, login, logout } from "./cli/commands.js";
import { terminalPrompter } from "./cli/prompt.js";
import { loadSettings } from "./config.js";
import { MailError } from "./errors.js";
import { VERSION } from "./version.js";

const HELP = `tecnico-mail-mcp ${VERSION}
Unofficial MCP server for your own Técnico mailbox. Not affiliated with IST or DSI.

Usage:
  tecnico-mail-mcp [--read-only | --allow-send]   start the server (your AI client runs this)
  tecnico-mail-mcp login                          test your login and store it in the OS keychain
  tecnico-mail-mcp logout                         remove the stored login
  tecnico-mail-mcp doctor                         check the connection without touching mail

Options:
  --read-only    only the tools that read mail
  --allow-send   also the tools that send mail (off by default)
  --version      print the version
  --help         print this help
`;

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "read-only": { type: "boolean", default: false },
      "allow-send": { type: "boolean", default: false },
      version: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });
  if (values.version) return void process.stdout.write(`${VERSION}\n`);
  if (values.help) return void process.stdout.write(HELP);

  const deps = defaultDependencies(terminalPrompter);
  switch (positionals[0]) {
    case "login": {
      const defaults = await loadSettings({
        env: {
          ...process.env,
          TECNICO_ID: "ist00000",
          TECNICO_EMAIL: "x@x.xx",
          TECNICO_PASSWORD: "x",
        },
        file: {},
      });
      return login(deps, defaults);
    }
    case "logout":
      return logout(deps);
    case "doctor":
      return doctor(deps);
    case "serve":
    case undefined:
      throw new MailError("unsupported", "The server is not built yet.");
    default:
      throw new MailError("invalid_input", `Unknown command "${positionals[0]}".`, "See --help.");
  }
}

main().catch((error: unknown) => {
  const text = error instanceof MailError ? error.describe() : String((error as Error).message);
  process.stderr.write(`${text}\n`);
  process.exit(1);
});
