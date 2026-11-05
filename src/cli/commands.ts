import {
  deleteIdentityFile,
  type Identity,
  loadSettings,
  parseTecnicoEmail,
  parseTecnicoId,
  readIdentityFile,
  type Settings,
  writeIdentityFile,
} from "../config.js";
import { checkImap, checkSmtp, type ImapReport } from "../connectivity.js";
import { deletePassword, readPassword, storePassword } from "../credentials.js";
import { MailError } from "../errors.js";
import type { Prompter } from "./prompt.js";

export interface Dependencies {
  prompter: Prompter;
  print: (line: string) => void;
  checkImap: (settings: Settings) => Promise<ImapReport>;
  checkSmtp: (settings: Settings) => Promise<void>;
  storePassword: (id: string, password: string) => Promise<boolean>;
  deletePassword: (id: string) => Promise<boolean>;
  writeIdentity: (identity: Identity) => Promise<void>;
  readIdentity: () => Promise<Partial<Identity>>;
  deleteIdentity: () => Promise<void>;
  loadSettings: () => Promise<Settings>;
}

export function defaultDependencies(prompter: Prompter): Dependencies {
  return {
    prompter,
    print: (line) => process.stderr.write(`${line}\n`),
    checkImap,
    checkSmtp,
    storePassword,
    deletePassword,
    writeIdentity: writeIdentityFile,
    readIdentity: readIdentityFile,
    deleteIdentity: deleteIdentityFile,
    loadSettings: () => loadSettings({ keychainPassword: readPassword }),
  };
}

/** Tests both logins before anything is saved, so a failed login leaves nothing behind. */
export async function login(
  deps: Dependencies,
  base: Pick<Settings, "imap" | "smtp">,
): Promise<void> {
  const { prompter, print } = deps;
  const id = parseTecnicoId(await prompter.ask("Técnico ID (istxxxxx): "));
  const email = parseTecnicoEmail(await prompter.ask("Técnico email address: "));
  const name = await prompter.ask("Your name, shown on mail you send (optional): ");
  const password = await prompter.askHidden("Password (hidden): ");
  if (!password) throw new MailError("config", "The password can't be empty.");

  const settings: Settings = { ...base, id, email, password, ...(name ? { name } : {}) };
  print("Testing IMAP login...");
  await deps.checkImap(settings);
  print("Testing SMTP login...");
  await deps.checkSmtp(settings);

  await deps.writeIdentity({ id, email, ...(name ? { name } : {}) });
  if (await deps.storePassword(id, password)) {
    print(`Logged in as ${id}. The password is in your OS keychain.`);
    return;
  }
  print(`Logins work, but this machine has no usable keychain, so the password was not saved.`);
  print("Set TECNICO_PASSWORD in your MCP client's config instead. See the README for the risks.");
}

export async function logout(deps: Dependencies): Promise<void> {
  const { id } = await deps.readIdentity();
  if (id) await deps.deletePassword(id);
  await deps.deleteIdentity();
  deps.print(id ? `Removed the stored login for ${id}.` : "No stored login was found.");
}

/** Read-only diagnostics for a bug report. Prints no mail and no credentials. */
export async function doctor(deps: Dependencies): Promise<void> {
  const { print } = deps;
  const settings = await deps.loadSettings();
  print(`Account:  ${settings.id}, sending as ${settings.email}`);
  print(
    `Server:   ${settings.imap.host}:${settings.imap.port}, ${settings.smtp.host}:${settings.smtp.port}`,
  );
  const report = await deps.checkImap(settings);
  print("IMAP:     login works");
  print(`Features: ${report.capabilities.join(" ")}`);
  for (const role of ["\\Sent", "\\Drafts", "\\Trash", "\\Junk", "\\Archive"]) {
    const folder = report.folders.find((f) => f.specialUse === role);
    print(`${role.slice(1).padEnd(9)} ${folder ? folder.path : "not detected"}`);
  }
  print(`Folders:  ${report.folders.length}`);
  await deps.checkSmtp(settings);
  print("SMTP:     login works. No message was sent.");
}
