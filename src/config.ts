import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { MailError } from "./errors.js";

export const SERVER_HOST = "mail.tecnico.ulisboa.pt";

export interface Endpoint {
  host: string;
  port: number;
}

export interface Identity {
  id: string;
  email: string;
  name?: string;
}

export interface Settings extends Identity {
  password: string;
  imap: Endpoint;
  smtp: Endpoint;
  /** Extra trusted certificate, set only by tests. TLS verification is never turned off. */
  tlsCa?: string;
}

type Env = Record<string, string | undefined>;

/** Claude Desktop passes optional fields left empty as the literal `${user_config.x}`. */
function value(env: Env, key: string): string | undefined {
  const raw = env[key]?.trim();
  return raw && !raw.startsWith("${") ? raw : undefined;
}

export function parseTecnicoId(input: string): string {
  const id = input.trim().toLowerCase();
  if (id.includes("@")) {
    throw new MailError(
      "config",
      `"${input.trim()}" looks like an email address.`,
      "The login username is your Técnico ID, in the form istxxxxx.",
    );
  }
  if (!/^ist\d{5,7}$/.test(id)) {
    throw new MailError(
      "config",
      `"${input.trim()}" is not a Técnico ID.`,
      "It has the form istxxxxx, for example ist123456.",
    );
  }
  return id;
}

export function parseTecnicoEmail(input: string): string {
  const email = input.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new MailError(
      "config",
      `"${input.trim()}" is not an email address.`,
      "Use the address you chose at activation, such as ana.silva@tecnico.ulisboa.pt.",
    );
  }
  if (/^ist\d+@/.test(email)) {
    throw new MailError(
      "config",
      "A Técnico address never has the form istxxxxx@tecnico.ulisboa.pt.",
      "Use the address you chose at activation, such as ana.silva@tecnico.ulisboa.pt.",
    );
  }
  return email;
}

export function configPath(env: Env = process.env, platform = process.platform): string {
  const base =
    (platform === "win32" ? value(env, "APPDATA") : value(env, "XDG_CONFIG_HOME")) ??
    join(homedir(), ".config");
  return join(base, "tecnico-mail-mcp", "config.json");
}

export async function readIdentityFile(path = configPath()): Promise<Partial<Identity>> {
  try {
    const { id, email, name } = JSON.parse(await readFile(path, "utf8"));
    return { id, email, ...(name ? { name } : {}) };
  } catch {
    return {};
  }
}

export async function writeIdentityFile(identity: Identity, path = configPath()): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(identity, null, 2)}\n`, { mode: 0o600 });
}

export async function deleteIdentityFile(path = configPath()): Promise<void> {
  await rm(path, { force: true });
}

function port(env: Env, key: string, fallback: number): number {
  const raw = value(env, key);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new MailError("config", `${key} must be a port number.`);
  }
  return parsed;
}

const NOT_LOGGED_IN =
  "Run `npx tecnico-mail-mcp login`, or set TECNICO_ID, TECNICO_EMAIL and TECNICO_PASSWORD. " +
  "In Claude Desktop, fill in the extension's settings.";

export interface SettingsSources {
  env?: Env;
  file?: Partial<Identity>;
  keychainPassword?: (id: string) => Promise<string | undefined>;
}

/** Environment first, then the config file. The password comes from the env or the keychain. */
export async function loadSettings(sources: SettingsSources = {}): Promise<Settings> {
  const env = sources.env ?? process.env;
  const file = sources.file ?? (await readIdentityFile());
  const rawId = value(env, "TECNICO_ID") ?? file.id;
  const rawEmail = value(env, "TECNICO_EMAIL") ?? file.email;
  if (!rawId || !rawEmail) {
    throw new MailError("config", "No Técnico account is configured.", NOT_LOGGED_IN);
  }
  const id = parseTecnicoId(rawId);
  const email = parseTecnicoEmail(rawEmail);
  const password = value(env, "TECNICO_PASSWORD") ?? (await sources.keychainPassword?.(id));
  if (!password) {
    throw new MailError("config", `No password is stored for ${id}.`, NOT_LOGGED_IN);
  }
  const name = value(env, "TECNICO_NAME") ?? file.name;
  return {
    id,
    email,
    password,
    ...(name ? { name } : {}),
    imap: {
      host: value(env, "TECNICO_IMAP_HOST") ?? SERVER_HOST,
      port: port(env, "TECNICO_IMAP_PORT", 993),
    },
    smtp: {
      host: value(env, "TECNICO_SMTP_HOST") ?? SERVER_HOST,
      port: port(env, "TECNICO_SMTP_PORT", 465),
    },
  };
}
