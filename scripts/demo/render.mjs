// Renders docs/assets/demo-transcript.json as docs/assets/demo.svg, an animated terminal window.
// The picture only shows recorded results, so it can't drift from what the server does.
import { readFileSync, writeFileSync } from "node:fs";

const { question, steps } = JSON.parse(readFileSync("docs/assets/demo-transcript.json", "utf8"));
const COLORS = {
  head: "#e6edf3",
  text: "#d7dae0",
  dim: "#8b949e",
  call: "#7ee787",
  key: "#f2cc60",
  ask: "#79c0ff",
};
const WIDTH = 860;
const LINE = 21;
const PAD = 24;
const TOP = 46;
const CHARS = 90;

const escapeXml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clip = (text, n = CHARS) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);
const senderName = (entry) => entry.replace(/ <.*$/, "");
const day = (iso) => iso.slice(0, 10);

const lines = [];
const add = (text, color = COLORS.text, wait = 0.35) => lines.push({ text, color, wait });

add(`> ${question}`, COLORS.ask, 0.8);
add("");
const [search, message, draft] = steps;
add(`search_messages ${JSON.stringify(search.input)}`, COLORS.call, 1.4);
for (const m of search.result.messages) {
  add(`  ${day(m.date)}  ${clip(senderName(m.from[0]), 24).padEnd(25)}${clip(m.subject, 56)}`);
}
add("");
add(`get_message {"uid":${message.result.uid}}`, COLORS.call, 1.4);
add(`  From:    ${message.result.from[0]}`, COLORS.dim);
add(`  Subject: ${message.result.subject}`, COLORS.dim);
add(`  ${clip(message.result.body)}`);
add("");
add(
  `create_draft {"reply_to":{"uid":${message.result.uid}},"body":${JSON.stringify(draft.input.body)}}`,
  COLORS.call,
  1.4,
);
add(`  Saved to ${draft.result.folder}: ${draft.result.subject}`);
add(`  ${draft.result.note}`, COLORS.key, 0.4);

const height = TOP + lines.length * LINE + PAD;
const total = lines.reduce((sum, l) => sum + l.wait, 0) + 8;
let at = 0.5;
const styles = [];
const rows = lines.map((line, i) => {
  at += line.wait;
  const start = ((at / total) * 100).toFixed(2);
  styles.push(
    `@keyframes l${i}{0%,${start}%{opacity:0}${(Number(start) + 0.01).toFixed(2)}%,100%{opacity:1}}.l${i}{animation:l${i} ${total.toFixed(1)}s infinite}`,
  );
  const y = TOP + (i + 1) * LINE;
  return `<text class="l${i}" x="${PAD}" y="${y}" fill="${line.color}" xml:space="preserve">${escapeXml(line.text)}</text>`;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="Recorded MCP tool calls on fictional mail: a search, reading one message, and saving a draft reply that is not sent.">
<style>text{font:13.5px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}${styles.join("")}@media (prefers-reduced-motion:reduce){text{animation:none!important}}</style>
<rect width="${WIDTH}" height="${height}" rx="12" fill="#16181d"/>
<rect width="${WIDTH}" height="32" rx="12" fill="#22252c"/><rect y="20" width="${WIDTH}" height="12" fill="#22252c"/>
<circle cx="20" cy="16" r="6" fill="#ff5f57"/><circle cx="40" cy="16" r="6" fill="#febc2e"/><circle cx="60" cy="16" r="6" fill="#28c840"/>
<text x="${WIDTH / 2}" y="21" fill="${COLORS.dim}" text-anchor="middle">tecnico-mail: recorded tool calls, fictional mail</text>
${rows.join("\n")}
</svg>
`;
writeFileSync("docs/assets/demo.svg", svg);
