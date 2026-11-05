import { describe, expect, test } from "vitest";
import type { Settings } from "../../src/config.js";
import { buildMessage, buildReply, parseAddress } from "../../src/mail/compose.js";
import type { ParsedMail } from "../../src/mail/parse.js";

const SETTINGS: Settings = {
  id: "ist123456",
  email: "ana.silva@tecnico.ulisboa.pt",
  name: "Ana Silva",
  password: "x",
  imap: { host: "h", port: 993 },
  smtp: { host: "h", port: 465 },
};

const mail = { to: ["rui@tecnico.ulisboa.pt"], cc: [], bcc: [], subject: "s", body: "b" };

const ORIGINAL: ParsedMail = {
  subject: "Reunião",
  from: ["Rui <rui@tecnico.ulisboa.pt>"],
  to: ["Ana <ana.silva@tecnico.ulisboa.pt>", "marta@tecnico.ulisboa.pt"],
  cc: ["Rui <rui@tecnico.ulisboa.pt>", "joao@tecnico.ulisboa.pt"],
  replyTo: [],
  date: "2026-11-02T10:00:00.000Z",
  messageId: "<m2@x>",
  references: ["<m1@x>"],
  isMailingList: false,
  body: "Olá\nAté já",
  bodyFromHtml: false,
  attachments: [],
  rawAttachments: [],
};

const options = { body: "Combinado", replyAll: false, quote: true };

describe("parseAddress", () => {
  test("accepts both forms the read tools return", () => {
    expect(parseAddress("a@b.pt")).toEqual({ address: "a@b.pt" });
    expect(parseAddress("Ana Silva <a@b.pt>")).toEqual({ name: "Ana Silva", address: "a@b.pt" });
    expect(parseAddress('"Silva, Ana" <a@b.pt>')).toEqual({
      name: "Silva, Ana",
      address: "a@b.pt",
    });
  });
  test.each(["nope", "a@b", "a b@c.pt", "a@b.pt\r\nBcc: evil@x.pt", "x <a@b.pt>\nBcc: evil@x.pt"])(
    "refuses %j",
    (bad) => expect(() => parseAddress(bad)).toThrow(/not a valid/),
  );
});

describe("buildMessage", () => {
  test("encodes accents with RFC 2047 and uses the chosen From address", async () => {
    const built = await buildMessage(SETTINGS, { ...mail, subject: "Avaliação" });
    const raw = built.delivered.toString();
    expect(raw).toMatch(/Subject: =\?UTF-8\?/);
    expect(raw).toContain("From: Ana Silva <ana.silva@tecnico.ulisboa.pt>");
    expect(built.envelope.from).toBe("ana.silva@tecnico.ulisboa.pt");
    expect(built.messageId).toMatch(/@tecnico\.ulisboa\.pt>$/);
  });

  test("keeps Bcc out of what recipients get and in the stored copy", async () => {
    const built = await buildMessage(SETTINGS, { ...mail, bcc: ["hidden@x.pt"] });
    expect(built.delivered.toString()).not.toContain("hidden@x.pt");
    expect(built.stored.toString()).toContain("Bcc: hidden@x.pt");
    expect(built.envelope.to).toEqual(["rui@tecnico.ulisboa.pt", "hidden@x.pt"]);
  });

  test("uses the same Message-ID in both copies", async () => {
    const built = await buildMessage(SETTINGS, mail);
    expect(built.stored.toString()).toContain(built.messageId);
    expect(built.delivered.toString()).toContain(built.messageId);
  });

  test("refuses header injection through the subject", async () => {
    await expect(
      buildMessage(SETTINGS, { ...mail, subject: "x\r\nBcc: evil@x.pt" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  test("refuses too many recipients and no recipients", async () => {
    const many = Array.from({ length: 21 }, (_, i) => `u${i}@x.pt`);
    await expect(buildMessage(SETTINGS, { ...mail, to: many })).rejects.toMatchObject({
      code: "limit",
    });
    await expect(buildMessage(SETTINGS, { ...mail, to: [] })).rejects.toMatchObject({
      code: "invalid_input",
    });
  });
});

describe("buildReply", () => {
  const own = SETTINGS.email;

  test("replies to the sender with threading headers and a quote", () => {
    const out = buildReply(ORIGINAL, own, options);
    expect(out.to).toEqual(["Rui <rui@tecnico.ulisboa.pt>"]);
    expect(out.cc).toEqual([]);
    expect(out.inReplyTo).toBe("<m2@x>");
    expect(out.references).toEqual(["<m1@x>", "<m2@x>"]);
    expect(out.body).toContain(
      "Combinado\n\nOn 2026-11-02T10:00:00.000Z, Rui <rui@tecnico.ulisboa.pt> wrote:\n> Olá\n> Até já",
    );
  });

  test("honors Reply-To and quote: false", () => {
    const out = buildReply({ ...ORIGINAL, replyTo: ["list@x.pt"] }, own, {
      ...options,
      quote: false,
    });
    expect(out.to).toEqual(["list@x.pt"]);
    expect(out.body).toBe("Combinado");
  });

  test.each([
    ["Reunião", "Re: Reunião"],
    ["Re: Reunião", "Re: Reunião"],
    ["RE: Reunião", "RE: Reunião"],
    ["res: Reunião", "res: Reunião"],
  ])("never stacks the prefix on %j", (subject, expected) => {
    expect(buildReply({ ...ORIGINAL, subject }, own, options).subject).toBe(expected);
  });

  test("reply all includes the others once and excludes the user", () => {
    const out = buildReply(ORIGINAL, own, { ...options, replyAll: true });
    expect(out.to).toEqual(["Rui <rui@tecnico.ulisboa.pt>"]);
    expect(out.cc).toEqual(["marta@tecnico.ulisboa.pt", "joao@tecnico.ulisboa.pt"]);
  });

  test("reply all refuses mailing-list mail", () => {
    expect(() =>
      buildReply({ ...ORIGINAL, isMailingList: true }, own, { ...options, replyAll: true }),
    ).toThrow(/mailing list/);
    expect(buildReply({ ...ORIGINAL, isMailingList: true }, own, options).to).toHaveLength(1);
  });

  test("replying to your own mail goes to its recipients", () => {
    const out = buildReply({ ...ORIGINAL, from: [own], to: ["marta@x.pt"], cc: [] }, own, options);
    expect(out.to).toEqual(["marta@x.pt"]);
  });
});
