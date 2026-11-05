import { type AddressObject, type Attachment, simpleParser } from "mailparser";
import { htmlToText } from "./html.js";
import { sanitizeLine, sanitizeText } from "./sanitize.js";

export interface MailAttachment {
  index: number;
  filename: string;
  contentType: string;
  size: number;
}

export interface ParsedMail {
  subject: string;
  from: string[];
  to: string[];
  cc: string[];
  replyTo: string[];
  date: string | null;
  messageId: string | null;
  references: string[];
  isMailingList: boolean;
  body: string;
  attachments: MailAttachment[];
  rawAttachments: Attachment[];
}

function addresses(field: AddressObject | AddressObject[] | undefined): string[] {
  const groups = Array.isArray(field) ? field : field ? [field] : [];
  return groups.flatMap((group) =>
    group.value.flatMap((a) => (a.group ?? [a]).map((m) => formatAddress(m.name, m.address))),
  );
}

function formatAddress(name?: string, address?: string): string {
  const cleanName = sanitizeLine(name ?? "");
  const cleanAddress = sanitizeLine(address ?? "");
  return cleanName && cleanAddress ? `${cleanName} <${cleanAddress}>` : cleanAddress || cleanName;
}

/** Keeps a hostile message from making later steps work through an enormous string. */
const MAX_TEXT_CHARS = 5_000_000;

/**
 * Prefers the HTML part, because that's what a person sees in webmail. A plain part can hold
 * different text, aimed at software rather than at the reader.
 */
function bestBody(text: string | undefined, html: string | false | undefined): string {
  const converted = html ? htmlToText(html) : "";
  return converted || sanitizeText((text ?? "").slice(0, MAX_TEXT_CHARS));
}

const LIST_HEADERS = ["list", "list-id", "list-post", "mailing-list", "x-mailman-version"];

function looksLikeMailingList(headers: Map<string, unknown>): boolean {
  const precedence = String(headers.get("precedence") ?? "").toLowerCase();
  return LIST_HEADERS.some((name) => headers.has(name)) || /list|bulk/.test(precedence);
}

/** Inline images in a signature or a template are not attachments a person would ask about. */
function isRealAttachment(part: Attachment): boolean {
  return !(part.related && part.contentType.startsWith("image/"));
}

export async function parseMail(source: Buffer): Promise<ParsedMail> {
  const mail = await simpleParser(source, {
    skipHtmlToText: true,
    skipTextToHtml: true,
    skipTextLinks: true,
    skipImageLinks: true,
  });
  const rawAttachments = mail.attachments.filter(isRealAttachment);
  const references = mail.references;
  return {
    subject: sanitizeLine(mail.subject ?? ""),
    from: addresses(mail.from),
    to: addresses(mail.to),
    cc: addresses(mail.cc),
    replyTo: addresses(mail.replyTo),
    date: mail.date ? mail.date.toISOString() : null,
    messageId: mail.messageId ?? null,
    references: Array.isArray(references) ? references : references ? [references] : [],
    isMailingList: looksLikeMailingList(mail.headers),
    body: bestBody(mail.text, mail.html),
    attachments: rawAttachments.map((part, index) => ({
      index,
      filename: sanitizeLine(part.filename ?? `attachment-${index}`),
      contentType: sanitizeLine(part.contentType),
      size: part.size,
    })),
    rawAttachments,
  };
}
