import { parseArgs } from "node:util";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { defaultDependencies, doctor, login, logout } from "./cli/commands.js";
import { terminalPrompter } from "./cli/prompt.js";
import { loadSettings } from "./config.js";
import { readPassword } from "./credentials.js";
import { MailError } from "./errors.js";
import { logInfo } from "./log.js";
import { type AccessMode, createServer, MailContext } from "./server.js";
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

function isTrue(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

export function accessMode(flags: { readOnly: boolean; allowSend: boolean }): AccessMode {
  if (flags.readOnly || isTrue(process.env.TECNICO_READ_ONLY)) return "read-only";
  return flags.allowSend || isTrue(process.env.TECNICO_ALLOW_SEND) ? "full" : "drafts";
}

/** Runs until the client closes stdin. A failed login is logged and returned by each tool call. */
async function serve(mode: AccessMode): Promise<void> {
  const context = new MailContext(() => loadSettings({ keychainPassword: readPassword }));
  await createServer(context, mode).connect(new StdioServerTransport());
  logInfo(`running in ${mode} mode`);
  context
    .session()
    .then((session) => session.run(async () => undefined))
    .then(() => logInfo("mail login works"))
    .catch((error: unknown) => {
      logInfo(error instanceof MailError ? error.describe() : "startup check failed");
    });
  const stop = () => void context.close().finally(() => process.exit(0));
  process.stdin.once("close", stop);
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}

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
      return serve(accessMode({ readOnly: values["read-only"], allowSend: values["allow-send"] }));
    default:
      throw new MailError("invalid_input", `Unknown command "${positionals[0]}".`, "See --help.");
  }
}

main().catch((error: unknown) => {
  const text = error instanceof MailError ? error.describe() : String((error as Error).message);
  process.stderr.write(`${text}\n`);
  process.exit(1);
});
