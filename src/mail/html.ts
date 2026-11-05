import render from "dom-serializer";
import { type ChildNode, type Document, type Element, isTag } from "domhandler";
import { convert } from "html-to-text";
import { parseDocument } from "htmlparser2";
import { sanitizeText } from "./sanitize.js";

const MAX_HTML_CHARS = 500_000;
const MAX_DEPTH = 256;
const MAX_STYLE_ATTRIBUTE_CHARS = 10_000;
const MAX_STYLESHEET_CHARS = 200_000;
const SHORTENED_NOTE = "\n\n[This message was shortened. Open it in webmail to see the rest.]";

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

type Style = Map<string, string>;

function withoutComments(css: string): string {
  return css
    .split("/*")
    .map((part, i) => {
      if (i === 0) return part;
      const end = part.indexOf("*/");
      return end < 0 ? "" : part.slice(end + 2);
    })
    .join("");
}

/** Lowercase, with CSS escapes decoded, and values without spaces or `!important`. */
function parseStyle(css: string): Style {
  const style: Style = new Map();
  const clean = withoutComments(css)
    .replace(/\\([0-9a-f]{1,6})\s?/gi, (_, hex: string) =>
      String.fromCodePoint(Math.min(Number.parseInt(hex, 16), 0x10ffff)),
    )
    .toLowerCase();
  for (const declaration of clean.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    const value = declaration
      .slice(colon + 1)
      .replace(/\s+/g, "")
      .replace("!important", "");
    style.set(declaration.slice(0, colon).trim(), value);
  }
  return style;
}

const OFF_SCREEN = ["left", "right", "top", "bottom", "text-indent", "margin-left", "margin-top"];
const ZERO_SIZE = ["width", "height", "max-width", "max-height"];

/** Properties a child can't undo, so everything inside the element is gone. */
function hidesSubtree(style: Style): boolean {
  if (style.get("display") === "none" || style.get("mso-hide") === "all") return true;
  if (Number.parseFloat(style.get("opacity") ?? "1") < 0.1) return true;
  if (style.get("clip")?.startsWith("rect(0")) return true;
  const clipPath = style.get("clip-path") ?? "";
  if (clipPath.startsWith("inset(100") || clipPath.startsWith("circle(0")) return true;
  if (style.get("transform")?.startsWith("scale(0")) return true;
  if (OFF_SCREEN.some((name) => Number.parseFloat(style.get(name) ?? "0") <= -100)) return true;
  // A zero-size box still shows its content, unless overflow is hidden.
  return (
    style.get("overflow") === "hidden" &&
    ZERO_SIZE.some((name) => Number.parseFloat(style.get(name) ?? "1") === 0)
  );
}

interface Inherited {
  invisible: boolean;
  tiny: boolean;
  transparent: boolean;
}

/**
 * Properties a child can override. Email templates often set `font-size:0` on a wrapper and a real
 * size on the content inside, so only text with no readable size of its own counts as hidden.
 */
function inheritedStyle(parent: Inherited, style: Style): Inherited {
  const next = { ...parent };
  const visibility = style.get("visibility");
  if (visibility === "hidden" || visibility === "collapse") next.invisible = true;
  else if (visibility === "visible") next.invisible = false;
  const color = style.get("color");
  if (color) next.transparent = color === "transparent";
  const size = style.get("font-size");
  if (size) {
    const number = Number.parseFloat(size);
    if (number === 0 || (number <= 1 && /(px|pt)$/.test(size))) next.tiny = true;
    else if (/(px|pt|rem)$/.test(size)) next.tiny = false;
  }
  return next;
}

interface Rule {
  classes: string[];
  style: Style;
}

interface Stylesheet {
  byClass: Map<string, Rule[]>;
  byId: Map<string, Style>;
}

function addRules(sheet: Stylesheet, selector: string, body: string): void {
  if (selector.includes("@")) return;
  const style = parseStyle(body);
  for (const raw of selector.split(",")) {
    const match = /^[a-z0-9]*((?:[.#][\w-]+)+)$/i.exec(raw.trim());
    if (!match?.[1]) continue;
    const parts = match[1].split(/(?=[.#])/);
    const id = parts.find((part) => part.startsWith("#"));
    if (id) {
      sheet.byId.set(id.slice(1), style);
      continue;
    }
    const classes = parts.map((part) => part.slice(1));
    const first = classes[0] as string;
    sheet.byClass.set(first, [...(sheet.byClass.get(first) ?? []), { classes, style }]);
  }
}

/** Reads top-level rules only. Rules in `@media` apply to some screens, so the text can be visible. */
function parseStylesheet(text: string): Stylesheet {
  const sheet: Stylesheet = { byClass: new Map(), byId: new Map() };
  const css = withoutComments(text.slice(0, MAX_STYLESHEET_CHARS));
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
        addRules(sheet, selector, css.slice(start, i));
        start = i + 1;
      }
    }
  }
  return sheet;
}

function collectStylesheet(document: Document): Stylesheet {
  let text = "";
  const stack: (Document | Element)[] = [document];
  while (stack.length > 0) {
    for (const child of stack.pop()?.children ?? []) {
      if (!isTag(child)) continue;
      if (child.name === "style") {
        for (const node of child.children) if ("data" in node) text += `${node.data}\n`;
      } else {
        stack.push(child);
      }
    }
  }
  return parseStylesheet(text);
}

function effectiveStyle(element: Element, sheet: Stylesheet): Style {
  const style: Style = new Map();
  const apply = (source: Style) => {
    for (const [key, value] of source) style.set(key, value);
  };
  const classes = new Set((element.attribs.class ?? "").split(/\s+/).filter(Boolean));
  for (const name of classes) {
    for (const rule of sheet.byClass.get(name) ?? []) {
      if (rule.classes.every((c) => classes.has(c))) apply(rule.style);
    }
  }
  const byId = sheet.byId.get(element.attribs.id ?? "");
  if (byId) apply(byId);
  if (element.attribs.style) apply(parseStyle(element.attribs.style));
  return style;
}

function isHiddenByMarkup({ name, attribs }: Element): boolean {
  if (INVISIBLE_ELEMENTS.has(name) || "hidden" in attribs) return true;
  if (name === "dialog" && !("open" in attribs)) return true;
  if (name === "font" && attribs.size === "0") return true;
  return (attribs.style?.length ?? 0) > MAX_STYLE_ATTRIBUTE_CHARS;
}

interface Pruned {
  html: string;
  shortened: boolean;
}

/** Removes what a mail client wouldn't show, because that text could be aimed at the model. */
function visibleHtml(html: string): Pruned {
  const document = parseDocument(html.slice(0, MAX_HTML_CHARS));
  const sheet = collectStylesheet(document);
  let shortened = html.length > MAX_HTML_CHARS;
  const start = { invisible: false, tiny: false, transparent: false };
  const stack: { node: Document | Element; depth: number; inherited: Inherited }[] = [
    { node: document, depth: 0, inherited: start },
  ];
  while (stack.length > 0) {
    const { node, depth, inherited } = stack.pop() as (typeof stack)[number];
    node.children = node.children.filter((child: ChildNode) => {
      if (child.type === "comment" || child.type === "directive") return false;
      if (child.type === "text") {
        return (
          !(inherited.invisible || inherited.tiny || inherited.transparent) || !child.data.trim()
        );
      }
      if (!isTag(child)) return true;
      if (isHiddenByMarkup(child)) return false;
      if (depth >= MAX_DEPTH) {
        shortened = true;
        return false;
      }
      const style = effectiveStyle(child, sheet);
      if (hidesSubtree(style)) return false;
      stack.push({ node: child, depth: depth + 1, inherited: inheritedStyle(inherited, style) });
      return true;
    });
  }
  return { html: render(document), shortened };
}

export function htmlToText(html: string): string {
  const { html: visible, shortened } = visibleHtml(html);
  const text = sanitizeText(
    convert(visible, {
      wordwrap: false,
      selectors: [{ selector: "a", options: { hideLinkHrefIfSameAsText: true } }],
    }),
  );
  return shortened ? `${text}${SHORTENED_NOTE}` : text;
}
