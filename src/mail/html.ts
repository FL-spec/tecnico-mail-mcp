import { convert } from "html-to-text";
import { sanitizeText } from "./sanitize.js";

const HIDDEN_STYLE =
  /(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0+)?\s*(?:;|$)|font-size\s*:\s*0(?:\.0+)?(?:px|pt|em|rem|%)?\s*(?:;|$)|(?:width|height|max-height)\s*:\s*0(?:px)?\s*(?:;|$))/i;

const MARKER = "data-tecnico-hidden";

/** Marks elements a mail client would not show. Their text could be aimed at the model instead. */
function markHiddenElements(html: string): string {
  return html.replace(/\bstyle\s*=\s*("[^"]*"|'[^']*')/gi, (attribute, quoted: string) =>
    HIDDEN_STYLE.test(quoted.slice(1, -1)) ? `${MARKER}="1"` : attribute,
  );
}

export function htmlToText(html: string): string {
  const skip = { format: "skip" };
  return sanitizeText(
    convert(markHiddenElements(html), {
      wordwrap: false,
      limits: { maxInputLength: 2_000_000 },
      selectors: [
        { selector: "img", ...skip },
        { selector: "[hidden]", ...skip },
        { selector: `[${MARKER}]`, ...skip },
        { selector: "template", ...skip },
        { selector: "noscript", ...skip },
        { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
        { selector: "table", format: "dataTable" },
      ],
    }),
  );
}
