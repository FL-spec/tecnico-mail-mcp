import { type AddressObject, type Attachment, simpleParser } from "mailparser";
import { htmlToText } from "./html.js";
import { sanitizeText } from "./sanitize.js";

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
  const clean = sanitizeText(name ?? "");
  return clean && address ? `${clean} <${address}>` : (address ?? clean);
}

// Some senders send a stub such as "view this in HTML" as the plain part.
const MIN_USEFUL_PLAIN_TEXT = 40;

function bestBody(text: string | undefined, html: string | false | undefined): string {
  const plain = sanitizeText(text ?? "");
  if (!html) return plain;
  if (plain.length >= MIN_USEFUL_PLAIN_TEXT) return plain;
  const converted = htmlToText(html);
  return converted.length > plain.length ? converted : plain;
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
    subject: sanitizeText(mail.subject ?? ""),
    from: addresses(mail.from),
    to: addresses(mail.to),
    cc: addresses(mail.cc),
    replyTo: addresses(mail.replyTo),
    date: mail.date ? mail.date.toISOString() : null,
    messageId: mail.messageId ?? null,
    references: Array.isArray(references) ? references : references ? [references] : [],
    isMailingList: mail.headers.has("list"),
    body: bestBody(mail.text, mail.html),
    attachments: rawAttachments.map((part, index) => ({
      index,
      filename: sanitizeText(part.filename ?? `attachment-${index}`),
      contentType: part.contentType,
      size: part.size,
    })),
    rawAttachments,
  };
}
