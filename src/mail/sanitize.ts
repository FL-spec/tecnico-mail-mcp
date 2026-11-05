// Default-ignorable and format characters can hide text from a person while a model still reads it:
// zero-width characters, bidi controls, Unicode tags, variation selectors, and fillers. U+200D stays:
// it joins emoji and is harmless on its own.
const INVISIBLE = /(?!\u200D)[\p{Default_Ignorable_Code_Point}\p{Cf}]/gu;
// Everything in the control category except tab and line feed. This also catches U+0085.
const CONTROL = /(?![\t\n])\p{Cc}/gu;
const LINE_SEPARATORS = /[\u2028\u2029]/g;

/** Runs in linear time: every piece of this text may come from a hostile sender. */
export function sanitizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(LINE_SEPARATORS, "\n")
    .replace(INVISIBLE, "")
    .replace(CONTROL, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** For values shown on one line, such as a subject or a sender's name. */
export function sanitizeLine(text: string): string {
  return sanitizeText(text).replace(/\s+/g, " ");
}

export function truncate(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, maxChars), truncated: true };
}
