# specs/server.md

## 1 · Purpose & boundary

Owns the MCP tools, access modes, the IMAP session, parsing, composing, the SMTP sender, and the
command line. It must not store mail, write attachments to disk, permanently delete messages, or
send credentials to any host other than the configured mail server.

## 2 · External surface

Filled in as each slice lands.

## 3 · Consumed & produced contracts

None. This is the only module.

## 4 · Invariants

Filled in as each slice lands.

## 5 · Configuration

Filled in as each slice lands.

## 6 · Decisions

- `wiki/architecture/decisions/2026-11-05-local-only.md`
- `wiki/architecture/decisions/2026-11-05-typescript-and-mcpb.md`
- `wiki/architecture/decisions/2026-11-05-optional-keychain-login.md`
- `wiki/prd/decisions/2026-11-05-sending-off-by-default.md`

## 7 · Current State

- Not yet specified: the server is a scaffold.
