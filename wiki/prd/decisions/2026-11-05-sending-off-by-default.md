# 2026-11-05—Sending stays off until the user turns it on

- **Status:** Accepted
- **Date:** 2026-11-05

## Context

The server reads mail from anyone and can send mail as the user. An email can carry text written
to manipulate the model into sending something, and MCP annotations are only hints that a client
may ignore. The planning document offered drafts as "the documented default for cautious users."

## Decision

The default access mode is `drafts`. It reads mail, saves drafts, sets flags, and moves messages.
The `send_message` and `reply` tools exist only after the user chooses `--allow-send`, or ticks
the matching box in the Desktop Extension.

## Consequences

A prompt injection can't send mail on a default install. The user reviews drafts in webmail and
sends them there, which costs a step. Someone who wants sending turns it on in one place.

## Alternatives considered

- **Send on by default, relying on client confirmation**—the safety would depend on each client.
- **Read-only by default**—safer, but drafting is most of the value and can't send anything.
