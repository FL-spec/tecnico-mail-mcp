# Master PRD

## Vision & Goals

Any Técnico student or staff member can connect their own mailbox to their AI client in under two
minutes, on their own machine, with their password staying on that machine.

## Actors

| Actor | Wants |
| --- | --- |
| Student on Claude Desktop | a double-click install with no terminal |
| Developer on Claude Code, Cursor, or VS Code | a one-line install and control over access |
| Cautious user | reading and drafts, with nothing sent without review |
| DSI | no bulk mail, no server strain, and no shared credentials |

## Cross-Module Scope

**In scope**

- Reading, searching, and drafting mail. Sending, flags, and moves.
- Text extraction from PDF, DOCX and plain-text attachments.

**Out of scope**

- A hosted version, because it would collect other people's passwords.
- Permanent delete, bulk sending, and sending attachments.
- Fénix data. It needs OAuth 2.0 and is a separate phase.

## Success Criteria

- The Desktop Extension installs with no other software on the machine.
- Every tool passes against a real Dovecot server in CI.
- `doctor` passes on a real Técnico account before each release.

## Child PRDs

- [Server](server.md)

## Open Questions

- The server advertises `OAUTHBEARER` and `XOAUTH2`, but DSI documents only normal passwords. If
  DSI opens OAuth 2.0 to outside applications, a password would no longer be needed.
