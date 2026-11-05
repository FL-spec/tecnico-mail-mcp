# specs/server.md

## 1 · Purpose & boundary

Owns the MCP tools, access modes, the IMAP session, parsing, composing, the SMTP sender, and the
command line. It must not store mail, write attachments to disk, permanently delete messages, or
send credentials to any host other than the configured mail server.

## 2 · External surface

### Command line

| Command | Effect |
| --- | --- |
| `tecnico-mail-mcp [--read-only \| --allow-send]` | starts the MCP server on stdio |
| `tecnico-mail-mcp login` | tests IMAP and SMTP, then stores the login |
| `tecnico-mail-mcp logout` | removes the stored login |
| `tecnico-mail-mcp doctor` | checks both logins and prints folders, without touching mail |

### Tools by access mode

| Tool | `read-only` | `drafts` (default) | `full` | Input | Annotations |
| --- | --- | --- | --- | --- | --- |
| `list_folders` | yes | yes | yes | none | read only |
| `search_messages` | yes | yes | yes | `folder`, `from`, `to`, `subject`, `text`, `since`, `before`, `unread`, `flagged`, `limit`, `offset` | read only |
| `get_message` | yes | yes | yes | `folder`, `uid`, `max_chars` | read only |
| `get_attachment` | yes | yes | yes | `folder`, `uid`, `index`, `max_chars` | read only |
| `create_draft` | no | yes | yes | `to`, `cc`, `bcc`, `subject`, `body`, `reply_to` | not destructive |
| `mark_read` | no | yes | yes | `folder`, `uids`, `read` | idempotent |
| `flag` | no | yes | yes | `folder`, `uids`, `flagged` | idempotent |
| `move_message` | no | yes | yes | `folder`, `uids`, `destination` | idempotent |
| `send_message` | no | no | yes | `to`, `cc`, `bcc`, `subject`, `body` | destructive, open world |
| `reply` | no | no | yes | `folder`, `uid`, `reply_all`, `quote`, `body` | destructive, open world |

Each tool returns one text block of JSON, or `isError: true` with a sentence naming the cause and
the next step. `since` and `before` compare the date the server received the message.

### Limits

| Limit | Value |
| --- | --- |
| Results per search | 50, default 20 |
| Folders listed | 200 |
| Characters of body or attachment text | 100,000, default 20,000 |
| Message size that can be read | 40 MiB |
| Attachment size that can be read | 25 MiB |
| UIDs per flag or move call | 50 |
| Recipients per message | 20 |
| Recipients per hour and per day, per running server | 60 and 200 |

## 3 · Consumed & produced contracts

None. This is the only module.

## 4 · Invariants

- `SRV-INV-1`: the read tools never change a message. Folders open read-only and fetches use
  `BODY.PEEK`.
- `SRV-INV-2`: the password appears in no log, tool result, or error message.
- `SRV-INV-3`: TLS certificates are always verified. No option turns verification off.
- `SRV-INV-4`: after a rejected login, on IMAP or SMTP, the server makes no further login attempt
  until restart.
- `SRV-INV-5`: operations on the IMAP connection run one at a time, at least 100 ms apart.
- `SRV-INV-6`: only idempotent reads retry after a dropped connection.
- `SRV-INV-7`: text hidden by the `hidden` attribute, inline styles, or top-level `.class` and `#id`
  rules never reaches a tool result, nor do default-ignorable or format Unicode characters. The body
  comes from the HTML when it has text. Text a person can see is kept. Filtering is a best effort
  without a layout engine (see §7).
- `SRV-INV-8`: attachment content is never written to disk.
- `SRV-INV-9`: `send_message` and `reply` exist only in `full` mode.
- `SRV-INV-10`: `Bcc` never appears in the delivered message.
- `SRV-INV-11`: a CR or LF in a subject or address is refused.
- `SRV-INV-12`: a send over the local budget is refused before any network call.
- `SRV-INV-13`: stdout carries only MCP protocol traffic.

## 5 · Configuration

| Env var | Required | Default | Meaning |
| --- | --- | --- | --- |
| `TECNICO_ID` | unless logged in | none | Técnico ID, `istxxxxx` |
| `TECNICO_EMAIL` | unless logged in | none | the address mail is sent from |
| `TECNICO_PASSWORD` | unless in the keychain | none | the Técnico ID password |
| `TECNICO_NAME` | no | none | display name on sent mail |
| `TECNICO_READ_ONLY` | no | `false` | `true` or `1` selects `read-only` |
| `TECNICO_ALLOW_SEND` | no | `false` | `true` or `1` selects `full` |
| `TECNICO_IMAP_HOST`, `TECNICO_IMAP_PORT` | no | `mail.tecnico.ulisboa.pt`, `993` | IMAP server |
| `TECNICO_SMTP_HOST`, `TECNICO_SMTP_PORT` | no | `mail.tecnico.ulisboa.pt`, `465` | SMTP server |

`--read-only` and `TECNICO_READ_ONLY` win over `--allow-send`. An environment variable wins over
the config file, which `login` writes to `$XDG_CONFIG_HOME/tecnico-mail-mcp/config.json`, or
`~/.config` or `%APPDATA%` when that's unset.

## 6 · Decisions

- `wiki/architecture/decisions/2026-11-05-local-only.md`
- `wiki/architecture/decisions/2026-11-05-typescript-and-mcpb.md`
- `wiki/architecture/decisions/2026-11-05-optional-keychain-login.md`
- `wiki/prd/decisions/2026-11-05-sending-off-by-default.md`

## 7 · Current State

- A real Técnico account has not run this server. CI uses Dovecot 2.4.1, the same server family,
  and a local SMTP server in place of Postfix.
- Some hidden text still reaches the model: text colored to match its background, closed `details`
  elements, `zoom` and translate transforms, and rules with tag, universal, or descendant selectors
  or `@media`. Telling those apart from normal design needs a browser's layout
  engine. This filter reduces prompt injection and doesn't prevent it; access modes are the control.
- The sending budget lives in memory, so restarting the server resets it.
- UIDs assume a stable `UIDVALIDITY`. If the server resets it, an old UID could name another
  message. A new search fixes this.
