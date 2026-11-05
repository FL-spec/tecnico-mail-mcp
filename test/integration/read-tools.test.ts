import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { Settings } from "../../src/config.js";
import { ImapSession } from "../../src/imap/session.js";
import { getMessage, listFolders, searchMessages } from "../../src/tools/read.js";
import { freshAccount, withRawClient } from "./helpers.js";

const base = { folder: "INBOX", limit: 20, offset: 0 };

function message(subject: string, from: string, date: string, body: string, extra = ""): string {
  return `From: ${from}\r\nTo: ana.silva@tecnico.ulisboa.pt\r\nSubject: ${subject}\r\nDate: ${date}\r\n${extra}Content-Type: text/plain; charset=utf-8\r\nMIME-Version: 1.0\r\n\r\n${body}\r\n`;
}

describe("read tools against Dovecot", () => {
  let account: Settings;
  let session: ImapSession;

  beforeAll(async () => {
    account = freshAccount();
    await withRawClient(account, async (client) => {
      await client.append(
        "INBOX",
        message(
          "Avaliação de Programação",
          "Prof. Rui <rui@tecnico.ulisboa.pt>",
          "Mon, 2 Nov 2026 10:00:00 +0000",
          "A avaliação é na terça-feira.",
        ),
        [],
        new Date("2026-11-02T10:00:00Z"),
      );
      await client.append(
        "INBOX",
        message(
          "Reunião",
          "Marta <marta@tecnico.ulisboa.pt>",
          "Tue, 3 Nov 2026 10:00:00 +0000",
          "Reunião de grupo amanhã.",
        ),
        ["\\Seen", "\\Flagged"],
        new Date("2026-11-03T10:00:00Z"),
      );
      await client.append(
        "INBOX",
        message(
          "Newsletter",
          "Núcleo <geral@nucleo.example>",
          "Wed, 4 Nov 2026 10:00:00 +0000",
          "Novidades do núcleo.",
        ),
        [],
        new Date("2026-11-04T10:00:00Z"),
      );
      await client.append(
        "Lixo",
        message("Old", "x@x.pt", "Wed, 4 Nov 2026 10:00:00 +0000", "old"),
      );
    });
    session = new ImapSession(account);
  });
  afterAll(() => session.close());

  test("list_folders gives roles and unread counts", async () => {
    const { folders } = await listFolders(session);
    expect(folders).toContainEqual({ path: "INBOX", role: "inbox", unread: 2, messages: 3 });
    expect(folders).toContainEqual({ path: "Enviados", role: "sent", unread: 0, messages: 0 });
    expect(folders).toContainEqual({
      path: "Lixo",
      role: "trash",
      unread: expect.any(Number),
      messages: expect.any(Number),
    });
  });

  test("search returns newest first with headers and a snippet", async () => {
    const result = await searchMessages(session, base);
    expect(result.total).toBe(3);
    expect(result.messages.map((m) => m.subject)).toEqual([
      "Newsletter",
      "Reunião",
      "Avaliação de Programação",
    ]);
    expect(result.messages[2]).toMatchObject({
      from: ["Prof. Rui <rui@tecnico.ulisboa.pt>"],
      unread: true,
      flagged: false,
      has_attachments: false,
      snippet: "A avaliação é na terça-feira.",
      date: "2026-11-02T10:00:00.000Z",
    });
  });

  test.each([
    [{ from: "rui@tecnico" }, ["Avaliação de Programação"]],
    [{ subject: "Avaliação" }, ["Avaliação de Programação"]],
    [{ text: "núcleo" }, ["Newsletter"]],
    [{ unread: false }, ["Reunião"]],
    [{ flagged: true }, ["Reunião"]],
    [{ since: "2026-11-04" }, ["Newsletter"]],
    [{ before: "2026-11-03" }, ["Avaliação de Programação"]],
    [{ since: "2026-11-02", from: "marta" }, ["Reunião"]],
    [{ subject: "does-not-exist" }, []],
  ])("search filter %j", async (filter, subjects) => {
    const result = await searchMessages(session, { ...base, ...filter });
    expect(result.messages.map((m) => m.subject)).toEqual(subjects);
  });

  test("search pages with limit and offset", async () => {
    const result = await searchMessages(session, { ...base, limit: 1, offset: 1 });
    expect(result).toMatchObject({ total: 3, returned: 1 });
    expect(result.messages[0]?.subject).toBe("Reunião");
  });

  test("search rejects a badly formed date", async () => {
    await expect(searchMessages(session, { ...base, since: "yesterday" })).rejects.toMatchObject({
      code: "invalid_input",
    });
  });

  test("get_message returns clean text and truncates when asked", async () => {
    const { messages } = await searchMessages(session, { ...base, subject: "Avaliação" });
    const uid = messages[0]?.uid ?? 0;
    const full = await getMessage(session, { folder: "INBOX", uid, max_chars: 20_000 });
    expect(full).toMatchObject({
      subject: "Avaliação de Programação",
      body: "A avaliação é na terça-feira.",
      body_truncated: false,
    });
    const cut = await getMessage(session, { folder: "INBOX", uid, max_chars: 5 });
    expect(cut).toMatchObject({ body: "A ava", body_truncated: true, body_chars: 29 });
  });

  test("reading and searching never mark mail as read", async () => {
    const { messages } = await searchMessages(session, { ...base, subject: "Avaliação" });
    await getMessage(session, { folder: "INBOX", uid: messages[0]?.uid ?? 0, max_chars: 100 });
    const flags = await withRawClient(account, async (client) => {
      const lock = await client.getMailboxLock("INBOX", { readOnly: true });
      try {
        const m = await client.fetchOne(String(messages[0]?.uid), { flags: true }, { uid: true });
        return m ? [...(m.flags ?? [])] : [];
      } finally {
        lock.release();
      }
    });
    expect(flags).not.toContain("\\Seen");
  });

  test("search sees mail that arrives while the folder stays selected", async () => {
    await searchMessages(session, { ...base, folder: "Lixo" });
    await withRawClient(account, (client) =>
      client.append("Lixo", message("Nova", "x@x.pt", "Thu, 5 Nov 2026 10:00:00 +0000", "nova")),
    );
    const result = await searchMessages(session, { ...base, folder: "Lixo", subject: "Nova" });
    expect(result.total).toBe(1);
  });

  test("search shows no snippet when the cut falls before the HTML part", async () => {
    const raw = [
      "From: x@x.pt",
      "Subject: Cortada",
      "Date: Thu, 5 Nov 2026 10:00:00 +0000",
      'Content-Type: multipart/alternative; boundary="b"',
      "",
      "--b",
      "Content-Type: text/plain",
      "",
      `Hostile plain part ${"x ".repeat(50_000)}`,
      "--b",
      "Content-Type: text/html",
      "",
      "<p>Visível</p>",
      "--b--",
      "",
    ].join("\r\n");
    await withRawClient(account, (client) => client.append("Enviados", raw));
    const result = await searchMessages(session, {
      ...base,
      folder: "Enviados",
      subject: "Cortada",
    });
    expect(result.messages[0]?.snippet).toBe("");
  });

  test("a UID that does not exist gives a clear error", async () => {
    await expect(
      getMessage(session, { folder: "INBOX", uid: 9999, max_chars: 100 }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  test("search caps the bytes it fetches per message but still snippets large mail", async () => {
    const big = message(
      "Big",
      "x@x.pt",
      "Thu, 5 Nov 2026 10:00:00 +0000",
      `Início ${"lorem ".repeat(50_000)}`,
    );
    await withRawClient(account, (client) => client.append("Enviados", big));
    const result = await searchMessages(session, { ...base, folder: "Enviados" });
    expect(result.messages[0]?.snippet.length).toBeLessThanOrEqual(200);
    expect(result.messages[0]?.snippet.startsWith("Início lorem")).toBe(true);
  });
});
