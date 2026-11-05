import { unzipSync } from "fflate";
import type { Attachment } from "mailparser";
import { MailError } from "../errors.js";
import { htmlToText } from "./html.js";
import { sanitizeText } from "./sanitize.js";

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
/** Limits an expanded DOCX, whose compressed form can be far smaller than its content. */
const MAX_EXPANDED_BYTES = 20 * 1024 * 1024;

const TEXT_TYPES = new Set(["application/json", "application/xml", "text/csv", "text/calendar"]);
const TEXT_EXTENSIONS = /\.(txt|md|csv|tsv|json|xml|log|ics|tex)$/i;

type Kind = "pdf" | "docx" | "html" | "text";

function kindOf(contentType: string, filename: string): Kind | null {
  const type = contentType.toLowerCase();
  const name = filename.toLowerCase();
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (type.includes("wordprocessingml") || name.endsWith(".docx")) return "docx";
  if (type === "text/html" || name.endsWith(".html") || name.endsWith(".htm")) return "html";
  if (type.startsWith("text/") || TEXT_TYPES.has(type) || TEXT_EXTENSIONS.test(name)) return "text";
  return null;
}

function decodeText(part: Attachment): string {
  const params = part.headers.get("content-type") as { params?: { charset?: string } } | undefined;
  const charset = params?.params?.charset ?? "utf-8";
  try {
    return new TextDecoder(charset, { fatal: true }).decode(part.content);
  } catch {
    return new TextDecoder("latin1").decode(part.content);
  }
}

async function pdfText(content: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  try {
    const document = await getDocumentProxy(new Uint8Array(content));
    const { text } = await extractText(document, { mergePages: true });
    return text;
  } catch {
    throw new MailError(
      "unsupported",
      "This PDF could not be read. It may be damaged or protected by a password.",
      "Open it in webmail.",
    );
  }
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, entity: string) => {
    if (!entity.startsWith("#")) return XML_ENTITIES[entity] ?? whole;
    const hex = entity[1]?.toLowerCase() === "x";
    const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    return code <= 0x10ffff ? String.fromCodePoint(code) : "";
  });
}

function docxText(content: Buffer): string {
  let tooLarge = false;
  let seen = false;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(content), {
      filter(file) {
        // A crafted archive can repeat this entry to make every copy expand.
        if (file.name !== "word/document.xml" || seen) return false;
        seen = true;
        tooLarge = file.originalSize > MAX_EXPANDED_BYTES;
        return !tooLarge;
      },
    });
  } catch {
    throw new MailError("unsupported", "This DOCX file is damaged.", "Open it in webmail.");
  }
  if (tooLarge)
    throw new MailError("limit", "This DOCX file expands to too much text to read here.");
  const xml = files["word/document.xml"];
  if (!xml) throw new MailError("unsupported", "This DOCX file has no document text.");
  return wordXmlText(new TextDecoder().decode(xml));
}

/** A single pass over the tags: hostile XML must not be able to cause regex backtracking. */
function wordXmlText(xml: string): string {
  let out = "";
  let inText = false;
  let hiddenRun = false;
  for (const piece of xml.split("<")) {
    const end = piece.indexOf(">");
    if (end < 0) continue;
    const tag = piece.slice(0, end);
    const name = /^\/?[\w:]+/.exec(tag)?.[0] ?? "";
    const selfClosing = tag.endsWith("/");
    if (name === "w:t" && !selfClosing) inText = true;
    else if (name === "/w:t") inText = false;
    else if (name === "w:r") hiddenRun = false;
    else if (name === "w:vanish") hiddenRun = !/w:val="(0|false)"/.test(tag);
    else if (name === "w:tab") out += "\t";
    else if (name === "/w:p") out += "\n";
    if (inText && !hiddenRun) out += decodeXmlEntities(piece.slice(end + 1));
  }
  return out;
}

/** Reads text out of an attachment in memory. Nothing from an attachment is written to disk. */
export async function extractText(part: Attachment, filename: string): Promise<string> {
  if (part.size > MAX_ATTACHMENT_BYTES) {
    throw new MailError(
      "limit",
      "This attachment is too large to read here.",
      "Open it in webmail.",
    );
  }
  switch (kindOf(part.contentType, filename)) {
    case "pdf":
      return sanitizeText(await pdfText(part.content));
    case "docx":
      return sanitizeText(docxText(part.content));
    case "html":
      return htmlToText(decodeText(part));
    case "text":
      return sanitizeText(decodeText(part));
    default:
      throw new MailError(
        "unsupported",
        `Text can't be read from "${filename}" (${part.contentType}).`,
        "PDF, DOCX, and plain text formats are supported. Open others in webmail.",
      );
  }
}
