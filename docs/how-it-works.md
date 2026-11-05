# How it works

The server is a small program your AI client starts on your computer. It holds one IMAP connection
to Técnico's mail server, and opens an SMTP connection only to send.

## Why it's built this way

**It runs locally.** DSI documents normal password login for mail, and the same password opens
Fénix. A hosted server would have to hold other people's passwords.

**It's written in TypeScript.** Claude Desktop ships Node.js and runs `.mcpb` extensions on it, so
students install nothing else.

**Sending is off by default.** The server reads mail from anyone and could send mail as you. An
email can carry text written to manipulate the model, and client confirmations are only hints. A
default install can't send, whatever a message says.

The [decision records](../wiki/architecture/00-architecture.md#decisions) give the full reasoning.

## Handling Técnico mail

| Detail | What the server does |
| --- | --- |
| The login is `istxxxxx`, and the address is something else | Asks for both, and refuses an email address as the ID or `istxxxxx@` as the address, as DSI says those never exist |
| Folder names vary by account and language | Finds folders by the IMAP SPECIAL-USE flags, then by English and Portuguese names |
| Much mail is HTML, in Portuguese, in older encodings | Decodes ISO-8859-1 and quoted-printable, and converts HTML to text |
| Only Técnico's servers may send for Técnico addresses | Always sends through `mail.tecnico.ulisboa.pt` |
| Sending limits block an account for 24 hours | Stops far below them, as the [tool reference](tools.md#sending-limits) shows |

## Handling untrusted mail

Anyone can email you, so the server treats mail as hostile input.

- It reads the HTML part when there is one, because that's what you see in webmail. A plain part can
  hold different text, aimed at software.
- It removes HTML elements a mail client wouldn't show, because their text could be aimed at the
  model. That covers the `hidden` attribute, inline styles such as `display:none` and off-screen
  positions, and simple style sheet rules. It can't detect text colored to match its background.
- It strips zero-width characters, bidi controls, Unicode tags, and other invisible characters.
- The server's instructions and each read tool's description tell the model that mail is data, not
  instructions. This reduces prompt injection, and nothing can fully prevent it.
- Attachments are parsed in memory, with limits on size and on DOCX expansion, and never saved.
- Parsing runs in linear time and input is capped, so one message can't freeze the server.
- CR and LF in subjects and addresses are refused, which stops header injection.

## The connection

One connection handles everything, and operations run one at a time, at least 100 ms apart. A closed
connection is replaced by a new one. Only reads retry after a dropped connection, because a write
may already have applied. A rejected password stops all further attempts until restart, because
repeated failures could lock the account. That holds for both IMAP and SMTP.

## Testing

| Layer | What runs | Where |
| --- | --- | --- |
| Unit | parsing, HTML, composing, limits, config, access modes | CI on three operating systems and two Node versions |
| Integration | every tool against real Dovecot 2.4.1 over verified TLS, and a local SMTP server with TLS and login | CI on Linux, needs Docker |
| End to end | both build outputs, started as real processes and driven over stdio by an MCP client | CI on Linux, needs Docker |
| Real account | `tecnico-mail-mcp doctor` on a real Técnico mailbox | by hand, before each release |

Dovecot is the software Técnico's IMAP server announces itself as. The SMTP stand-in isn't Postfix,
which Técnico runs, so Postfix-specific behavior isn't covered by CI.

Run the tests with:

```bash
npm test
```

```bash
npm run test:integration
```
