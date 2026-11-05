import { randomUUID } from "node:crypto";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import type { Settings } from "../config.js";
import { MailError } from "../errors.js";
import type { ParsedMail } from "./parse.js";

export const MAX_RECIPIENTS = 20;
const MAX_BODY_CHARS = 1_000_000;
const MAX_SUBJECT_CHARS = 500;

export interface OutgoingMail {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string[];
}

export interface Address {
  name?: string;
  address: string;
}

const ADDRESS = /^[^\s<>@,;:"()[\]\\]+@[^\s<>@,;:"()[\]\\]+\.[^\s<>@,;:"()[\]\\.]+$/;

/** Accepts `a@b.pt` and `Name <a@b.pt>`, the forms the read tools return. */
export function parseAddress(input: string): Address {
  const text = input.trim();
  const named = /^(.*)<([^<>]+)>$/.exec(text);
  const address = (named?.[2] ?? text).trim();
  const name = named?.[1]?.trim().replace(/^"|"$/g, "");
  // biome-ignore lint/suspicious/noControlCharactersInRegex: a line break here is header injection
  if (!ADDRESS.test(address) || /[\u0000-\u001F]/.test(text)) {
    throw new MailError("invalid_input", `"${input}" is not a valid email address.`);
  }
  return { address, ...(name ? { name } : {}) };
}

export function normalizeOutgoing(mail: OutgoingMail): {
  to: Address[];
  cc: Address[];
  bcc: Address[];
} {
  const to = mail.to.map(parseAddress);
  const cc = mail.cc.map(parseAddress);
  const bcc = mail.bcc.map(parseAddress);
  const count = to.length + cc.length + bcc.length;
  if (count === 0) throw new MailError("invalid_input", "A message needs at least one recipient.");
  if (count > MAX_RECIPIENTS) {
    throw new MailError(
      "limit",
      `A message can have ${MAX_RECIPIENTS} recipients at most, and this one has ${count}.`,
      "This tool is for personal mail. Técnico's rules require approval for mass mailings.",
    );
  }
  if (/[\r\n]/.test(mail.subject) || mail.subject.length > MAX_SUBJECT_CHARS) {
    throw new MailError("invalid_input", "The subject must be one line of 500 characters at most.");
  }
  if (mail.body.length > MAX_BODY_CHARS) {
    throw new MailError("limit", "The message body is too long.");
  }
  return { to, cc, bcc };
}

export interface BuiltMessage {
  /** What recipients get: no Bcc header. */
  delivered: Buffer;
  /** What the Sent and Drafts folders keep: Bcc header included. */
  stored: Buffer;
  messageId: string;
  envelope: { from: string; to: string[] };
}

function compile(
  options: ConstructorParameters<typeof MailComposer>[0],
  keepBcc: boolean,
): Promise<Buffer> {
  const node = new MailComposer(options).compile();
  node.keepBcc = keepBcc;
  return new Promise((resolve, reject) =>
    node.build((error, message) => (error ? reject(error) : resolve(message))),
  );
}

export async function buildMessage(settings: Settings, mail: OutgoingMail): Promise<BuiltMessage> {
  const { to, cc, bcc } = normalizeOutgoing(mail);
  const domain = settings.email.split("@")[1];
  const messageId = `<${randomUUID()}@${domain}>`;
  const options = {
    from: { name: settings.name ?? "", address: settings.email },
    to,
    cc,
    bcc,
    subject: mail.subject,
    text: mail.body,
    messageId,
    date: new Date(),
    ...(mail.inReplyTo ? { inReplyTo: mail.inReplyTo } : {}),
    ...(mail.references?.length ? { references: mail.references } : {}),
  };
  return {
    delivered: await compile(options, false),
    stored: await compile(options, true),
    messageId,
    envelope: {
      from: settings.email,
      to: [...to, ...cc, ...bcc].map((a) => a.address),
    },
  };
}

function addressOf(entry: string): string {
  return (/<([^<>]+)>$/.exec(entry)?.[1] ?? entry).toLowerCase();
}

function uniqueWithout(entries: string[], excluded: Set<string>): string[] {
  const seen = new Set(excluded);
  return entries.filter((entry) => {
    const address = addressOf(entry);
    if (seen.has(address)) return false;
    seen.add(address);
    return true;
  });
}

const QUOTE_CHARS = 10_000;

export interface ReplyOptions {
  body: string;
  replyAll: boolean;
  quote: boolean;
}

/** Works out recipients, subject, threading headers, and quoting for a reply. */
export function buildReply(
  original: ParsedMail,
  ownEmail: string,
  options: ReplyOptions,
): OutgoingMail {
  if (options.replyAll && original.isMailingList) {
    throw new MailError(
      "invalid_input",
      "This message came through a mailing list, so reply all could reach a whole course or group.",
      "Use reply without reply_all, or send_message with the exact recipients.",
    );
  }
  const own = new Set([ownEmail.toLowerCase()]);
  const sender = original.replyTo.length > 0 ? original.replyTo : original.from;
  let to = uniqueWithout(sender, own);
  // Replying to mail you sent yourself goes back to its original recipients.
  if (to.length === 0) to = uniqueWithout(original.to, own);
  const cc = options.replyAll
    ? uniqueWithout([...original.to, ...original.cc], new Set([...own, ...to.map(addressOf)]))
    : [];
  const subject = /^\s*(re|res|ref)\s*:/i.test(original.subject)
    ? original.subject
    : `Re: ${original.subject}`;
  const quoted = original.body
    .slice(0, QUOTE_CHARS)
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  const attribution = `On ${original.date ?? "an unknown date"}, ${original.from[0] ?? "the sender"} wrote:`;
  return {
    to,
    cc,
    bcc: [],
    subject,
    body: options.quote ? `${options.body}\n\n${attribution}\n${quoted}\n` : options.body,
    ...(original.messageId
      ? {
          inReplyTo: original.messageId,
          references: [...original.references, original.messageId],
        }
      : {}),
  };
}
