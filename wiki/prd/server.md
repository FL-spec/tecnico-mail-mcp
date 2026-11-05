# Server PRD

## Problem & Context

Técnico mail has no API. It offers standard IMAP and SMTP. Generic email MCP servers can reach it, but
none knows its rules: the login differs from the address, folder names vary, and sending limits
can block an account for 24 hours.

## Actors & Goals

See the [master PRD](00-master-prd.md).

## Functional Requirements

1. List folders with unread counts.
2. Search on the server by sender, recipient, subject, text, date range, unread, and flagged state.
3. Return a message as clean text with its attachment list.
4. Extract text from PDF, DOCX and plain-text attachments.
5. Save a draft, including a threaded reply draft.
6. Send a message or a reply, and keep a copy in Sent.
7. Mark as read or unread, flag and unflag, and move between folders.
8. Limit tools by access mode: `read-only`, `drafts` or `full`.
9. Offer `login`, `logout` and `doctor` commands for people not using the Desktop Extension.

## Business Rules

- Results are capped so a search can't fill the model's context.
- A message may have 20 recipients at most. A running server allows 60 recipients per hour and
  200 per day. DSI blocks an account for 24 hours at 500 per day, counting each recipient.
- `reply_all` refuses mailing-list mail, so a reply can't reach a whole course by accident.

## Decisions

- [Sending stays off until the user turns it on](decisions/2026-11-05-sending-off-by-default.md)

## Non-Goals

See "Out of scope" in the [master PRD](00-master-prd.md).

## Open Questions

- _(none yet)_
