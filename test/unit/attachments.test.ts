import { zipSync } from "fflate";
import type { Attachment } from "mailparser";
import { describe, expect, test } from "vitest";
import { extractText } from "../../src/mail/attachments.js";

function part(contentType: string, content: Buffer, charset?: string): Attachment {
  return {
    contentType,
    content,
    size: content.length,
    headers: new Map([
      ["content-type", { value: contentType, params: charset ? { charset } : {} }],
    ]),
  } as unknown as Attachment;
}

function docx(xml: string): Buffer {
  return Buffer.from(zipSync({ "word/document.xml": new TextEncoder().encode(xml) }));
}

/** A one-page PDF with real text, built by hand so the test needs no fixture file. */
function pdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

describe("extractText", () => {
  test("reads a PDF", async () => {
    expect(
      await extractText(part("application/pdf", pdf("Enunciado do projeto")), "e.pdf"),
    ).toContain("Enunciado do projeto");
  });

  test("explains an unreadable PDF", async () => {
    await expect(
      extractText(part("application/pdf", Buffer.from("not a pdf")), "e.pdf"),
    ).rejects.toMatchObject({
      code: "unsupported",
    });
  });

  test("reads a DOCX with paragraphs, entities, and accents", async () => {
    const xml =
      '<w:document><w:body><w:p><w:r><w:t>Avaliação &amp; notas</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Linha 2</w:t><w:tab/><w:t>&#233;</w:t></w:r></w:p></w:body></w:document>';
    expect(await extractText(part("application/octet-stream", docx(xml)), "a.docx")).toBe(
      "Avaliação & notas\nLinha 2\té",
    );
  });

  test("refuses a DOCX zip bomb before expanding it", async () => {
    const bomb = Buffer.from(zipSync({ "word/document.xml": new Uint8Array(30 * 1024 * 1024) }));
    expect(bomb.length).toBeLessThan(1024 * 1024);
    await expect(extractText(part("application/zip", bomb), "b.docx")).rejects.toMatchObject({
      code: "limit",
    });
  });

  test("doesn't freeze on a tiny DOCX of unclosed tags", async () => {
    const start = Date.now();
    await extractText(part("application/zip", docx("<w:t ".repeat(40_000))), "b.docx");
    expect(Date.now() - start).toBeLessThan(1_000);
  });

  test("drops hidden runs from a DOCX", async () => {
    const xml =
      "<w:p><w:r><w:rPr><w:vanish/></w:rPr><w:t>IGNORE</w:t></w:r><w:r><w:t>Olá</w:t></w:r></w:p>";
    expect(await extractText(part("application/zip", docx(xml)), "b.docx")).toBe("Olá");
  });

  test("explains a damaged DOCX", async () => {
    await expect(
      extractText(part("application/zip", Buffer.from("nope")), "b.docx"),
    ).rejects.toMatchObject({
      code: "unsupported",
    });
  });

  test("decodes text by its charset", async () => {
    const latin = Buffer.from("Avaliação", "latin1");
    expect(await extractText(part("text/plain", latin, "iso-8859-1"), "a.txt")).toBe("Avaliação");
    expect(await extractText(part("text/plain", latin), "a.txt")).toBe("Avaliação");
  });

  test("converts HTML and removes hidden text", async () => {
    const html = Buffer.from('<p>Olá</p><p style="display:none">IGNORE</p>');
    expect(await extractText(part("text/html", html), "a.html")).toBe("Olá");
  });

  test("strips invisible characters from attachments too", async () => {
    expect(await extractText(part("text/plain", Buffer.from("a\u200Bb")), "a.txt")).toBe("ab");
  });

  test("refuses other types and names what works", async () => {
    const error = await extractText(part("image/png", Buffer.from("x")), "a.png").catch((e) => e);
    expect(error.code).toBe("unsupported");
    expect(error.describe()).toMatch(/PDF, DOCX/);
  });

  test("refuses an attachment over the size limit", async () => {
    const large = { ...part("text/plain", Buffer.from("x")), size: 26 * 1024 * 1024 } as Attachment;
    await expect(extractText(large, "a.txt")).rejects.toMatchObject({ code: "limit" });
  });
});
