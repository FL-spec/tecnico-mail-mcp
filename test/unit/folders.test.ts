import type { ListResponse } from "imapflow";
import { describe, expect, test } from "vitest";
import { findFolder, folderRole } from "../../src/imap/folders.js";

const folder = (path: string, specialUse?: string) =>
  ({ path, delimiter: "/", ...(specialUse ? { specialUse } : {}) }) as ListResponse;

describe("folderRole", () => {
  test("trusts SPECIAL-USE whatever the name", () => {
    expect(folderRole(folder("Caixa", "\\Sent"))).toBe("sent");
  });
  test.each([
    ["Enviados", "sent"],
    ["Itens Enviados", "sent"],
    ["Sent Items", "sent"],
    ["Rascunhos", "drafts"],
    ["Drafts", "drafts"],
    ["Lixo", "trash"],
    ["Itens Eliminados", "trash"],
    ["Spam", "junk"],
    ["INBOX/Enviados", "sent"],
  ])("falls back to the name %s", (name, role) => {
    expect(folderRole(folder(name))).toBe(role);
  });
  test("returns null for an ordinary folder", () => {
    expect(folderRole(folder("Cadeiras/PO"))).toBeNull();
  });
  test("ignores a special-use flag it does not know", () => {
    expect(folderRole(folder("Importantes", "\\Important"))).toBeNull();
  });
});

describe("findFolder", () => {
  test("prefers a flagged folder over a name match", () => {
    const folders = [folder("Lixo"), folder("Reciclagem", "\\Trash")];
    expect(findFolder(folders, "trash")).toBe("Reciclagem");
  });
  test("returns null when nothing matches", () => {
    expect(findFolder([folder("INBOX")], "sent")).toBeNull();
  });
});
