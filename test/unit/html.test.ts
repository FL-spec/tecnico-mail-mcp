import { describe, expect, test } from "vitest";
import { htmlToText } from "../../src/mail/html.js";
import { sanitizeText, truncate } from "../../src/mail/sanitize.js";

describe("htmlToText", () => {
  test("keeps visible text and accents", () => {
    expect(htmlToText("<p>Avaliação de <b>Programação</b></p><p>Época especial</p>")).toBe(
      "Avaliação de Programação\n\nÉpoca especial",
    );
  });

  test("keeps a link's target", () => {
    expect(htmlToText('<a href="https://fenix.tecnico.ulisboa.pt/x">Fénix</a>')).toContain(
      "https://fenix.tecnico.ulisboa.pt/x",
    );
  });

  test("drops scripts, styles, and the head", () => {
    const out = htmlToText(
      "<html><head><title>T</title><style>a{}</style></head><body>Olá<script>evil()</script></body></html>",
    );
    expect(out).toBe("Olá");
  });

  test.each([
    '<div style="display:none">IGNORE</div>Olá',
    '<div style="DISPLAY : NONE;color:red">IGNORE</div>Olá',
    "<div style='visibility: hidden'>IGNORE</div>Olá",
    '<span style="font-size:0">IGNORE</span>Olá',
    '<span style="font-size: 0px;">IGNORE</span>Olá',
    '<span style="opacity:0">IGNORE</span>Olá',
    '<div style="height:0;overflow:hidden">IGNORE</div>Olá',
    "<div hidden>IGNORE</div>Olá",
    "<template>IGNORE</template>Olá",
    "<div style=display:none>IGNORE</div>Olá",
    '<div style="display&#58;none">IGNORE</div>Olá',
    '<div style="display:/**/none">IGNORE</div>Olá',
    '<div style="opacity:0 !important">IGNORE</div>Olá',
    '<div style="font-size:0 !important">IGNORE</div>Olá',
    '<div style="opacity:.0">IGNORE</div>Olá',
    '<div style="font-size:1px">IGNORE</div>Olá',
    '<div style="position:absolute;left:-9999px">IGNORE</div>Olá',
    '<div style="text-indent:-9999px">IGNORE</div>Olá',
    '<div style="color:transparent">IGNORE</div>Olá',
    '<div style="mso-hide:all">IGNORE</div>Olá',
    '<font size="0">IGNORE</font>Olá',
    '<style>.x{display:none}</style><div class="y x">IGNORE</div>Olá',
    '<style>div.x, #z { font-size: 0 }</style><div id="z">IGNORE</div>Olá',
    `<div style="${"x:y;".repeat(3000)}display:none">IGNORE</div>Olá`,
  ])("removes hidden text aimed at the model: %s", (html) => {
    expect(htmlToText(html)).toBe("Olá");
  });

  test("keeps text that a rule hides only on some screens", () => {
    const html =
      '<style>@media (max-width:600px){.d{display:none}}</style><div class="d">Visível</div>';
    expect(htmlToText(html)).toBe("Visível");
  });

  test.each([
    ["a huge colspan", `<table><tr><td colspan="100000">x</td></tr></table>`],
    ["deep nesting", "<div>".repeat(200_000)],
    ["unclosed comments in a style", `<div style="${"/*".repeat(4000)}">x</div>`],
    ["a huge stylesheet", `<style>${"{".repeat(200_000)}</style>x`],
  ])("doesn't freeze on %s", (_name, html) => {
    const start = Date.now();
    htmlToText(html);
    expect(Date.now() - start).toBeLessThan(3_000);
  });

  test("keeps small but visible text", () => {
    expect(htmlToText('<span style="font-size:0.9em">Visível</span>')).toBe("Visível");
    expect(htmlToText('<span style="opacity:0.5">Visível</span>')).toBe("Visível");
  });
});

describe("sanitizeText", () => {
  test("removes zero-width, bidi, and tag characters", () => {
    expect(sanitizeText("a\u200Bb\u202Ec\u{E0041}d\uFEFF")).toBe("abcd");
  });
  test.each([
    ["U+E0100", "\u{E0100}"],
    ["U+FE0F", "\uFE0F"],
    ["U+3164", "\u3164"],
    ["U+034F", "\u034F"],
    ["U+061C", "\u061C"],
    ["U+0085", "\u0085"],
    ["U+00AD", "\u00AD"],
  ])("removes %s", (_name, char) => expect(sanitizeText(`a${char}b`)).toBe("ab"));
  test("keeps emoji joiners and Portuguese text", () => {
    expect(sanitizeText("Coração 👩\u200D💻")).toBe("Coração 👩\u200D💻");
  });
  test("normalizes line ends and blank runs", () => {
    expect(sanitizeText("a\r\nb  \n\n\n\nc\u0007")).toBe("a\nb\n\nc");
  });
});

describe("truncate", () => {
  test("reports whether it cut anything", () => {
    expect(truncate("abc", 5)).toEqual({ text: "abc", truncated: false });
    expect(truncate("abcdef", 3)).toEqual({ text: "abc", truncated: true });
  });
});
