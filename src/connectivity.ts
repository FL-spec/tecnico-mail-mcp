import type { Settings } from "./config.js";
import { toMailError } from "./errors.js";
import { createImapClient } from "./imap/session.js";
import { createSmtpTransport } from "./smtp/transport.js";

export interface ImapReport {
  capabilities: string[];
  folders: { path: string; specialUse?: string }[];
}

/** One login and logout on a throwaway connection. */
export async function checkImap(settings: Settings): Promise<ImapReport> {
  const client = createImapClient(settings);
  client.on("error", () => undefined);
  try {
    await client.connect();
    const folders = await client.list();
    const capabilities = [...(client.capabilities?.keys() ?? [])].sort();
    await client.logout();
    return {
      capabilities,
      folders: folders.map((f) => ({
        path: f.path,
        ...(f.specialUse ? { specialUse: f.specialUse } : {}),
      })),
    };
  } catch (error) {
    client.close();
    throw toMailError(error);
  }
}

/** Connects and authenticates. Sends nothing. */
export async function checkSmtp(settings: Settings): Promise<void> {
  const transport = createSmtpTransport(settings);
  try {
    await transport.verify();
  } catch (error) {
    throw toMailError(error);
  } finally {
    transport.close();
  }
}
