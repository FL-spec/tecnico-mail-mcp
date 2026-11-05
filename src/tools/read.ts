import type { FetchMessageObject, ImapFlow, SearchObject } from "imapflow";
import { MailError } from "../errors.js";
import { folderRole } from "../imap/folders.js";
import type { ImapSession } from "../imap/session.js";
import { extractText } from "../mail/attachments.js";
import { parseMail } from "../mail/parse.js";
import { sanitizeLine, truncate } from "../mail/sanitize.js";

export const MAX_RESULTS = 50;
const MAX_FOLDERS = 200;
/** Enough of the message start to find its first text part. */
const SNIPPET_BYTES = 16 * 1024;
const SNIPPET_CHARS = 200;
/** Técnico's SMTP server advertises 36,700,160 bytes as its largest message. */
export const MAX_MESSAGE_BYTES = 40 * 1024 * 1024;

export interface SearchInput {
  folder: string;
  from?: string | undefined;
  to?: string | undefined;
  subject?: string | undefined;
  text?: string | undefined;
  since?: string | undefined;
  before?: string | undefined;
  unread?: boolean | undefined;
  flagged?: boolean | undefined;
  limit: number;
  offset: number;
}

export async function listFolders(session: ImapSession) {
  const folders = await session.run(
    (client) => client.list({ statusQuery: { unseen: true, messages: true } }),
    { retry: true },
  );
  const usable = folders.filter((f) => !f.flags.has("\\Noselect"));
  return {
    total: usable.length,
    truncated: usable.length > MAX_FOLDERS,
    folders: usable.slice(0, MAX_FOLDERS).map((f) => ({
      path: f.path,
      role: f.path === "INBOX" ? "inbox" : folderRole(f),
      unread: f.status?.unseen ?? null,
      messages: f.status?.messages ?? null,
    })),
  };
}

function parseDay(value: string, field: string): Date {
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())) {
    throw new MailError("invalid_input", `${field} must be a date in the form YYYY-MM-DD.`);
  }
  return date;
}

function buildQuery(input: SearchInput): SearchObject {
  const query: SearchObject = {};
  if (input.from) query.from = input.from;
  if (input.to) query.to = input.to;
  if (input.subject) query.subject = input.subject;
  if (input.text) query.text = input.text;
  if (input.since) query.since = parseDay(input.since, "since");
  if (input.before) query.before = parseDay(input.before, "before");
  if (input.unread !== undefined) query.seen = !input.unread;
  if (input.flagged !== undefined) query.flagged = input.flagged;
  return Object.keys(query).length > 0 ? query : { all: true };
}

function hasAttachments(part: FetchMessageObject["bodyStructure"]): boolean {
  if (!part) return false;
  if (part.disposition === "attachment") return true;
  return (part.childNodes ?? []).some(hasAttachments);
}

function summarize(
  addresses: { name?: string | undefined; address?: string | undefined }[] | undefined,
): string[] {
  return (addresses ?? []).map((a) => {
    const name = sanitizeLine(a.name ?? "");
    const address = sanitizeLine(a.address ?? "");
    return name && address ? `${name} <${address}>` : address || name;
  });
}

export async function searchMessages(session: ImapSession, input: SearchInput) {
  const query = buildQuery(input);
  const { total, fetched } = await session.withFolder(input.folder, "read", async (client) => {
    const found = await client.search(query, { uid: true });
    const uids = (found || []).sort((a, b) => b - a);
    const page = uids.slice(input.offset, input.offset + input.limit);
    const fetched: FetchMessageObject[] = [];
    if (page.length > 0) {
      const options = {
        uid: true,
        flags: true,
        envelope: true,
        bodyStructure: true,
        internalDate: true,
        size: true,
        source: { start: 0, maxLength: SNIPPET_BYTES },
      };
      for await (const message of client.fetch(page, options, { uid: true })) fetched.push(message);
    }
    return { total: uids.length, fetched };
  });

  const messages = await Promise.all(
    fetched
      .sort((a, b) => b.uid - a.uid)
      .map(async (m) => {
        const { body } = m.source ? await parseMail(m.source) : { body: "" };
        const date = m.envelope?.date ?? m.internalDate;
        return {
          uid: m.uid,
          date: date ? new Date(date).toISOString() : null,
          from: summarize(m.envelope?.from),
          to: summarize(m.envelope?.to),
          subject: sanitizeLine(m.envelope?.subject ?? ""),
          unread: !m.flags?.has("\\Seen"),
          flagged: m.flags?.has("\\Flagged") ?? false,
          has_attachments: hasAttachments(m.bodyStructure),
          size: m.size ?? null,
          snippet: truncate(body.replace(/\s+/g, " "), SNIPPET_CHARS).text,
        };
      }),
  );
  return { folder: input.folder, total, offset: input.offset, returned: messages.length, messages };
}

/** Fetches the whole message without setting the Seen flag. The folder is open read-only too. */
export async function fetchSource(client: ImapFlow, uid: number): Promise<Buffer> {
  const head = await client.fetchOne(String(uid), { size: true }, { uid: true });
  if (!head)
    throw new MailError("not_found", `No message has UID ${uid} in this folder.`, "Search again.");
  if ((head.size ?? 0) > MAX_MESSAGE_BYTES) {
    throw new MailError("limit", "This message is too large to read here.", "Open it in webmail.");
  }
  const full = await client.fetchOne(String(uid), { source: true }, { uid: true });
  const source = full ? full.source : undefined;
  if (!source) throw new MailError("not_found", `No message has UID ${uid} in this folder.`);
  return source;
}

export async function getMessage(
  session: ImapSession,
  input: { folder: string; uid: number; max_chars: number },
) {
  const { source, flags } = await session.withFolder(input.folder, "read", async (client) => {
    const source = await fetchSource(client, input.uid);
    const meta = await client.fetchOne(String(input.uid), { flags: true }, { uid: true });
    return { source, flags: meta ? meta.flags : undefined };
  });
  const mail = await parseMail(source);
  const { text, truncated } = truncate(mail.body, input.max_chars);
  return {
    folder: input.folder,
    uid: input.uid,
    subject: mail.subject,
    from: mail.from,
    to: mail.to,
    cc: mail.cc,
    reply_to: mail.replyTo,
    date: mail.date,
    is_mailing_list: mail.isMailingList,
    unread: !flags?.has("\\Seen"),
    flagged: flags?.has("\\Flagged") ?? false,
    body: text,
    body_truncated: truncated,
    body_chars: mail.body.length,
    attachments: mail.attachments.map((a) => ({
      index: a.index,
      filename: a.filename,
      content_type: a.contentType,
      size: a.size,
    })),
  };
}

export async function getAttachment(
  session: ImapSession,
  input: { folder: string; uid: number; index: number; max_chars: number },
) {
  const source = await session.withFolder(input.folder, "read", (client) =>
    fetchSource(client, input.uid),
  );
  const mail = await parseMail(source);
  const info = mail.attachments[input.index];
  const part = mail.rawAttachments[input.index];
  if (!info || !part) {
    throw new MailError(
      "not_found",
      `This message has no attachment ${input.index}.`,
      `It has ${mail.attachments.length}.`,
    );
  }
  const extracted = await extractText(part, info.filename);
  const { text, truncated } = truncate(extracted, input.max_chars);
  return {
    filename: info.filename,
    content_type: info.contentType,
    size: info.size,
    text,
    text_truncated: truncated,
    text_chars: extracted.length,
    ...(extracted.length === 0
      ? { note: "No text found. A scanned PDF holds only images, which this tool can't read." }
      : {}),
  };
}
