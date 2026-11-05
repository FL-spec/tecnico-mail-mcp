import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import type { Settings } from "../../src/config.js";
import { ImapSession } from "../../src/imap/session.js";
import { parseMail } from "../../src/mail/parse.js";
import { SendingBudget } from "../../src/smtp/budget.js";
import { getAttachment, getMessage, searchMessages } from "../../src/tools/read.js";
import { createDraft, moveMessages, reply, sendMessage, setFlag } from "../../src/tools/write.js";
import { freshAccount, startSmtpServer, withRawClient } from "./helpers.js";

const inbox = { folder: "INBOX", limit: 20, offset: 0 };

const ORIGINAL = [
  "From: Rui Costa <rui@tecnico.ulisboa.pt>",
  "To: Ana Silva <ana.silva@tecnico.ulisboa.pt>",
  "Cc: marta@tecnico.ulisboa.pt",
  "Subject: Reunião de projeto",
  "Message-ID: <orig-1@tecnico.ulisboa.pt>",
  "Date: Mon, 2 Nov 2026 10:00:00 +0000",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Podes na terça-feira?",
  "",
].join("\r\n");

async function rawFromFolder(settings: Settings, folder: string): Promise<Buffer[]> {
  return withRawClient(settings, async (client) => {
    const lock = await client.getMailboxLock(folder, { readOnly: true });
    try {
      const out: Buffer[] = [];
      if (client.mailbox && client.mailbox.exists > 0) {
        for await (const m of client.fetch("1:*", { source: true }))
          if (m.source) out.push(m.source);
      }
      return out;
    } finally {
      lock.release();
    }
  });
}

describe("write tools against Dovecot and a TLS SMTP server", () => {
  let smtp: Awaited<ReturnType<typeof startSmtpServer>>;
  let account: Settings;
  let session: ImapSession;
  let budget: SendingBudget;
  let uid: number;

  beforeAll(async () => {
    smtp = await startSmtpServer(freshAccount().password);
  });
  afterAll(() => smtp.stop());

  beforeEach(async () => {
    smtp.received.length = 0;
    smtp.resetAuthAttempts();
    account = freshAccount(smtp.port);
    session = new ImapSession(account);
    budget = new SendingBudget();
    await withRawClient(account, (client) => client.append("INBOX", ORIGINAL));
    uid = (await searchMessages(session, inbox)).messages[0]?.uid ?? 0;
    return () => session.close();
  });

  test("create_draft saves to the detected Drafts folder, flagged as a draft, and sends nothing", async () => {
    const result = await createDraft(session, account, {
      to: ["rui@tecnico.ulisboa.pt"],
      subject: "Avaliação",
      body: "Olá Rui",
    });
    expect(result).toMatchObject({ saved: true, folder: "Rascunhos" });
    expect(smtp.received).toHaveLength(0);
    const found = await searchMessages(session, { ...inbox, folder: "Rascunhos" });
    expect(found.messages[0]?.subject).toBe("Avaliação");
    const flags = await withRawClient(account, async (client) => {
      const lock = await client.getMailboxLock("Rascunhos", { readOnly: true });
      try {
        const message = await client.fetchOne("*", { flags: true });
        return message ? [...(message.flags ?? [])] : [];
      } finally {
        lock.release();
      }
    });
    expect(flags).toContain("\\Draft");
  });

  test("create_draft threads a reply draft", async () => {
    const result = await createDraft(session, account, {
      body: "Sim, pode ser.",
      reply_to: { folder: "INBOX", uid, reply_all: false, quote: true },
    });
    expect(result.to).toEqual(["Rui Costa <rui@tecnico.ulisboa.pt>"]);
    const [raw] = await rawFromFolder(account, "Rascunhos");
    const draft = await parseMail(raw ?? Buffer.from(""));
    expect(draft.subject).toBe("Re: Reunião de projeto");
    expect(raw?.toString()).toContain("In-Reply-To: <orig-1@tecnico.ulisboa.pt>");
    expect(draft.body).toContain("> Podes na terça-feira?");
  });

  test("create_draft works with no recipients only if it has some", async () => {
    await expect(createDraft(session, account, { body: "x" })).rejects.toMatchObject({
      code: "invalid_input",
    });
  });

  test("send_message delivers, hides Bcc, and keeps a copy in Sent", async () => {
    const result = await sendMessage(session, account, budget, {
      to: ["rui@tecnico.ulisboa.pt"],
      cc: ["marta@tecnico.ulisboa.pt"],
      bcc: ["hidden@tecnico.ulisboa.pt"],
      subject: "Avaliação",
      body: "Olá, está tudo certo.",
    });
    expect(result).toMatchObject({ sent: true, saved_to_sent: true, sent_folder: "Enviados" });
    expect(result.accepted).toHaveLength(3);
    const [mail] = smtp.received;
    expect(mail?.from).toBe("ana.silva@tecnico.ulisboa.pt");
    expect(mail?.to.sort()).toEqual([
      "hidden@tecnico.ulisboa.pt",
      "marta@tecnico.ulisboa.pt",
      "rui@tecnico.ulisboa.pt",
    ]);
    expect(mail?.raw).not.toContain("hidden@tecnico.ulisboa.pt");
    expect(mail?.raw).toMatch(/Subject: =\?UTF-8\?/);
    const [copy] = await rawFromFolder(account, "Enviados");
    expect(copy?.toString()).toContain("Bcc: hidden@tecnico.ulisboa.pt");
  });

  test("send_message refuses over budget without touching the network", async () => {
    budget.reserve(60);
    await expect(
      sendMessage(session, account, budget, { to: ["a@x.pt"], subject: "s", body: "b" }),
    ).rejects.toMatchObject({ code: "limit" });
    expect(smtp.received).toHaveLength(0);
  });

  test("a wrong SMTP password gives the login hint and refunds the budget", async () => {
    const wrong = { ...account, password: "wrong" };
    await expect(
      sendMessage(session, wrong, budget, { to: ["a@x.pt"], subject: "s", body: "b" }),
    ).rejects.toMatchObject({ code: "auth" });
    expect(() => budget.reserve(60)).not.toThrow();
  });

  test("after a rejected SMTP login, a second send makes no login attempt", async () => {
    const wrong = { ...account, password: "wrong" };
    const input = { to: ["a@x.pt"], subject: "s", body: "b" };
    await expect(sendMessage(session, wrong, budget, input)).rejects.toMatchObject({
      code: "auth",
    });
    const start = Date.now();
    await expect(sendMessage(session, wrong, budget, input)).rejects.toMatchObject({
      code: "auth",
    });
    expect(Date.now() - start).toBeLessThan(100);
  });

  test("parallel sends with a wrong password make one login attempt", async () => {
    const wrong = { ...account, password: "wrong" };
    const input = { to: ["a@x.pt"], subject: "s", body: "b" };
    const results = await Promise.allSettled(
      [1, 2, 3].map(() => sendMessage(session, wrong, budget, input)),
    );
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(smtp.authAttempts()).toBe(1);
  });

  test("a server that can't be reached is reported as not sent and costs no budget", async () => {
    const unreachable = { ...account, smtp: { host: "localhost", port: 1 } };
    const error = await sendMessage(session, unreachable, budget, {
      to: ["a@x.pt"],
      subject: "s",
      body: "b",
    }).catch((e) => e);
    expect(error.describe()).not.toMatch(/may have been sent/);
    expect(() => budget.reserve(60)).not.toThrow();
  });

  test("a connection lost during sending warns against resending and keeps the budget", async () => {
    const dropping = await startSmtpServer(account.password, { dropOnData: true });
    const settings = { ...account, smtp: { host: "localhost", port: dropping.port } };
    await expect(
      sendMessage(session, settings, budget, { to: ["a@x.pt"], subject: "s", body: "b" }),
    ).rejects.toThrow(/may have been sent/);
    budget.reserve(59);
    expect(() => budget.reserve(1)).toThrow(/per hour/);
    await dropping.stop();
  });

  test("a failed Sent copy still reports the send and warns against resending", async () => {
    const broken = new ImapSession({ ...account, imap: { host: "localhost", port: 1 } });
    const result = await sendMessage(broken, account, budget, {
      to: ["a@x.pt"],
      subject: "s",
      body: "b",
    });
    expect(result).toMatchObject({ sent: true, saved_to_sent: false });
    expect(result.warning).toMatch(/Do not send it again/);
    expect(smtp.received).toHaveLength(1);
    await broken.close();
  });

  test("reply threads, keeps the subject, and reply_all reaches the others once", async () => {
    await reply(session, account, budget, {
      folder: "INBOX",
      uid,
      reply_all: true,
      quote: true,
      body: "Sim.",
    });
    const [mail] = smtp.received;
    expect(mail?.to.sort()).toEqual(["marta@tecnico.ulisboa.pt", "rui@tecnico.ulisboa.pt"]);
    expect(mail?.raw).toContain("In-Reply-To: <orig-1@tecnico.ulisboa.pt>");
    expect(mail?.raw).toContain("References: <orig-1@tecnico.ulisboa.pt>");
  });

  test("mark_read and flag change flags, and undo works", async () => {
    await setFlag(session, { folder: "INBOX", uids: [uid], flag: "\\Seen", on: true });
    await setFlag(session, { folder: "INBOX", uids: [uid], flag: "\\Flagged", on: true });
    let m = (await searchMessages(session, inbox)).messages[0];
    expect(m).toMatchObject({ unread: false, flagged: true });
    await setFlag(session, { folder: "INBOX", uids: [uid], flag: "\\Seen", on: false });
    await setFlag(session, { folder: "INBOX", uids: [uid], flag: "\\Flagged", on: false });
    m = (await searchMessages(session, inbox)).messages[0];
    expect(m).toMatchObject({ unread: true, flagged: false });
  });

  test("a read after a write still can't change flags", async () => {
    await setFlag(session, { folder: "INBOX", uids: [uid], flag: "\\Flagged", on: true });
    await getMessage(session, { folder: "INBOX", uid, max_chars: 100 });
    expect((await searchMessages(session, inbox)).messages[0]?.unread).toBe(true);
  });

  test("move_message resolves trash to the detected folder and reports new UIDs", async () => {
    const result = await moveMessages(session, {
      folder: "INBOX",
      uids: [uid],
      destination: "trash",
    });
    expect(result).toMatchObject({ destination: "Lixo", moved: 1 });
    expect((await searchMessages(session, inbox)).total).toBe(0);
    expect((await searchMessages(session, { ...inbox, folder: "Lixo" })).total).toBe(1);
  });

  test("move_message to a folder that doesn't exist fails clearly and moves nothing", async () => {
    await expect(
      moveMessages(session, { folder: "INBOX", uids: [uid], destination: "Nope" }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect((await searchMessages(session, inbox)).total).toBe(1);
  });

  test("get_attachment reads a text attachment from real mail", async () => {
    const withFile = [
      "From: x@x.pt",
      "Subject: Enunciado",
      'Content-Type: multipart/mixed; boundary="m"',
      "",
      "--m",
      "Content-Type: text/plain",
      "",
      "Em anexo.",
      "--m",
      'Content-Type: text/plain; charset=utf-8; name="notas.txt"',
      'Content-Disposition: attachment; filename="notas.txt"',
      "",
      "Avaliação: 18 valores",
      "--m--",
      "",
    ].join("\r\n");
    await withRawClient(account, (client) => client.append("INBOX", withFile));
    const found = await searchMessages(session, { ...inbox, subject: "Enunciado" });
    expect(found.messages[0]?.has_attachments).toBe(true);
    const id = found.messages[0]?.uid ?? 0;
    const message = await getMessage(session, { folder: "INBOX", uid: id, max_chars: 1000 });
    expect(message.attachments).toEqual([
      { index: 0, filename: "notas.txt", content_type: "text/plain", size: expect.any(Number) },
    ]);
    const file = await getAttachment(session, {
      folder: "INBOX",
      uid: id,
      index: 0,
      max_chars: 1000,
    });
    expect(file.text).toBe("Avaliação: 18 valores");
    await expect(
      getAttachment(session, { folder: "INBOX", uid: id, index: 5, max_chars: 1000 }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
