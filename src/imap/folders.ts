import type { ImapFlow, ListResponse } from "imapflow";
import { MailError } from "../errors.js";

export type FolderRole = "sent" | "drafts" | "trash" | "junk" | "archive";

// Used only when the server doesn't flag a folder with SPECIAL-USE. Compared in lowercase, on the
// last part of the path, so "INBOX.Enviados" also matches.
const NAMES: Record<FolderRole, string[]> = {
  sent: [
    "sent",
    "sent items",
    "sent messages",
    "sent mail",
    "enviados",
    "enviadas",
    "itens enviados",
    "mensagens enviadas",
    "correio enviado",
  ],
  drafts: ["drafts", "draft", "rascunhos", "rascunho"],
  trash: [
    "trash",
    "deleted",
    "deleted items",
    "deleted messages",
    "lixo",
    "reciclagem",
    "itens eliminados",
    "mensagens eliminadas",
    "eliminados",
    "apagados",
  ],
  junk: [
    "junk",
    "spam",
    "junk e-mail",
    "junk email",
    "lixo eletrónico",
    "lixo eletronico",
    "correio não solicitado",
  ],
  archive: ["archive", "archives", "arquivo", "arquivos"],
};

const ROLES = Object.keys(NAMES) as FolderRole[];

export function folderRole(
  folder: Pick<ListResponse, "path" | "specialUse" | "delimiter">,
): FolderRole | null {
  if (folder.specialUse) {
    const flag = folder.specialUse.slice(1).toLowerCase();
    if (ROLES.includes(flag as FolderRole)) return flag as FolderRole;
  }
  const last = (folder.delimiter ? folder.path.split(folder.delimiter).at(-1) : folder.path) ?? "";
  const name = last.toLowerCase();
  return ROLES.find((role) => NAMES[role].includes(name)) ?? null;
}

/** Flagged folders win over name matches, so a folder someone named "Lixo" can't hide the real one. */
export function findFolder(folders: ListResponse[], role: FolderRole): string | null {
  const flagged = folders.find((f) => f.specialUse?.slice(1).toLowerCase() === role);
  return (flagged ?? folders.find((f) => folderRole(f) === role))?.path ?? null;
}

const CREATED_NAME: Partial<Record<FolderRole, string>> = { sent: "Sent", drafts: "Drafts" };

/** Sent and Drafts are created when missing, as mail clients do. Other roles must already exist. */
export async function requireFolder(client: ImapFlow, role: FolderRole): Promise<string> {
  const found = findFolder(await client.list(), role);
  if (found) return found;
  const name = CREATED_NAME[role];
  if (!name) {
    throw new MailError("not_found", `This mailbox has no ${role} folder.`, "Use list_folders.");
  }
  const created = await client.mailboxCreate(name);
  return created.path;
}
