import render from "dom-serializer";
import { type Document, type Element, isTag } from "domhandler";
import { convert } from "html-to-text";
import { parseDocument } from "htmlparser2";
import { sanitizeText } from "./sanitize.js";

const MAX_HTML_CHARS = 500_000;
const MAX_DEPTH = 64;
const MAX_STYLE_ATTRIBUTE_CHARS = 10_000;
const MAX_STYLESHEET_CHARS = 200_000;

const INVISIBLE_ELEMENTS = new Set([
  "script",
  "style",
  "head",
  "title",
  "meta",
  "link",
  "template",
  "noscript",
  "object",
  "embed",
  "iframe",
  "svg",
  "math",
  "img",
  "audio",
  "video",
  "canvas",
]);

function withoutComments(css: string): string {
  const parts = css.split("/*");
  return parts
    .map((part, i) => {
      if (i === 0) return part;
      const end = part.indexOf("*/");
      return end < 0 ? "" : part.slice(end + 2);
    })
    .join("");
}

function isHiddenDeclaration(property: string, value: string): boolean {
  const number = Number.parseFloat(value);
  switch (property) {
    case "display":
      return value === "none";
    case "visibility":
      return value === "hidden" || value === "collapse";
    case "opacity":
      return number < 0.1;
    case "font-size":
      return number === 0 || (number <= 1 && /(px|pt)$/.test(value));
    case "width":
    case "height":
    case "max-width":
    case "max-height":
      return number === 0;
    case "left":
    case "right":
    case "top":
    case "bottom":
    case "text-indent":
    case "margin-left":
    case "margin-top":
      return number <= -500;
    case "clip":
      return value.startsWith("rect(0");
    case "clip-path":
      return value.startsWith("inset(100") || value.startsWith("circle(0");
    case "transform":
      return value.startsWith("scale(0");
    case "color":
      return value === "transparent";
    case "mso-hide":
      return value === "all";
    default:
      return false;
  }
}

/** Declarations are compared lowercase, without spaces, comments, or `!important`. */
function isHiddenStyle(css: string): boolean {
  return withoutComments(css)
    .toLowerCase()
    .split(";")
    .some((declaration) => {
      const colon = declaration.indexOf(":");
      if (colon < 0) return false;
      const property = declaration.slice(0, colon).trim();
      const value = declaration
        .slice(colon + 1)
        .replace(/\s+/g, "")
        .replace("!important", "");
      return isHiddenDeclaration(property, value);
    });
}

interface HiddenSelectors {
  classes: Set<string>;
  ids: Set<string>;
}

/**
 * Finds `.class` and `#id` rules that hide content. Rules inside `@media` are skipped: they usually
 * hide content on one kind of screen only, and the text is visible on the others.
 */
function hiddenSelectors(stylesheet: string): HiddenSelectors {
  const hidden: HiddenSelectors = { classes: new Set(), ids: new Set() };
  const css = withoutComments(stylesheet.slice(0, MAX_STYLESHEET_CHARS));
  let depth = 0;
  let start = 0;
  let selector = "";
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "{") {
      if (depth === 0) {
        selector = css.slice(start, i);
        start = i + 1;
      }
      depth++;
    } else if (css[i] === "}") {
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        if (!selector.includes("@") && isHiddenStyle(css.slice(start, i))) {
          for (const raw of selector.split(",")) {
            const match = /^[a-z0-9]*([.#])([\w-]+)$/i.exec(raw.trim());
            if (match?.[2]) (match[1] === "." ? hidden.classes : hidden.ids).add(match[2]);
          }
        }
        start = i + 1;
      }
    }
  }
  return hidden;
}

function collectStylesheets(document: Document): HiddenSelectors {
  let text = "";
  const stack: { children?: unknown[] }[] = [document];
  while (stack.length > 0) {
    for (const child of (stack.pop()?.children ?? []) as Element[]) {
      if (child.name === "style") {
        for (const node of child.children) if ("data" in node) text += `${node.data}\n`;
      } else if (child.children) {
        stack.push(child);
      }
    }
  }
  return hiddenSelectors(text);
}

function isHiddenElement(element: Element, hidden: HiddenSelectors): boolean {
  const { attribs } = element;
  if (INVISIBLE_ELEMENTS.has(element.name) || "hidden" in attribs) return true;
  if (element.name === "font" && attribs.size === "0") return true;
  const style = attribs.style;
  if (style && (style.length > MAX_STYLE_ATTRIBUTE_CHARS || isHiddenStyle(style))) return true;
  if (attribs.id && hidden.ids.has(attribs.id)) return true;
  return (attribs.class ?? "").split(/\s+/).some((name) => hidden.classes.has(name));
}

/** Removes what a mail client wouldn't show, because that text could be aimed at the model. */
function visibleHtml(html: string): string {
  const document = parseDocument(html.slice(0, MAX_HTML_CHARS));
  const hidden = collectStylesheets(document);
  const stack: { node: Document | Element; depth: number }[] = [{ node: document, depth: 0 }];
  while (stack.length > 0) {
    const { node, depth } = stack.pop() as { node: Document | Element; depth: number };
    node.children = node.children.filter((child) => {
      if (child.type === "comment" || child.type === "directive") return false;
      if (!isTag(child)) return true;
      if (depth >= MAX_DEPTH || isHiddenElement(child, hidden)) return false;
      stack.push({ node: child, depth: depth + 1 });
      return true;
    });
  }
  return render(document);
}

export function htmlToText(html: string): string {
  return sanitizeText(
    convert(visibleHtml(html), {
      wordwrap: false,
      selectors: [{ selector: "a", options: { hideLinkHrefIfSameAsText: true } }],
    }),
  );
}
