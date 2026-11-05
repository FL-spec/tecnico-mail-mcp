// Zero-width characters, bidi controls and Unicode tag characters can hide text from a person while
// a model still reads it. U+200D stays: it joins emoji and is harmless on its own.
// biome-ignore lint/complexity/useRegexLiterals: a literal invites tools to embed the invisible characters
const INVISIBLE = new RegExp(
  "[\\u00AD\\u200B\\u200C\\u200E\\u200F\\u202A-\\u202E\\u2060-\\u2064\\u2066-\\u206F\\uFEFF\\u{E0000}-\\u{E007F}]",
  "gu",
);
// biome-ignore lint/complexity/useRegexLiterals: same reason as above
const CONTROL = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]", "g");

export function sanitizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(INVISIBLE, "")
    .replace(CONTROL, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function truncate(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, maxChars), truncated: true };
}
