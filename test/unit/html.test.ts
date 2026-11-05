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
  ])("removes hidden text aimed at the model: %s", (html) => {
    expect(htmlToText(html)).toBe("Olá");
  });

  test("keeps small but visible text", () => {
    expect(htmlToText('<span style="font-size:0.9em">Visível</span>')).toBe("Visível");
    expect(htmlToText('<span style="opacity:0.5">Visível</span>')).toBe("Visível");
  });
});

describe("sanitizeText", () => {
  test("removes zero-width, bidi, and tag characters", () => {
    expect(sanitizeText("a​b‮c\u{E0041}d﻿")).toBe("abcd");
  });
  test("keeps emoji joiners and Portuguese text", () => {
    expect(sanitizeText("Coração 👩‍💻")).toBe("Coração 👩‍💻");
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
