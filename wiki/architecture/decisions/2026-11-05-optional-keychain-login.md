# 2026-11-05—Optional keychain login for npx users

- **Status:** Accepted
- **Date:** 2026-11-05

## Context

Desktop Extension users get keychain storage from Claude Desktop. The npx path was planned around
environment variables in the client's config, which leaves a password in shell history and in a
plaintext file. That password also opens Fénix.

## Decision

Keep environment variables as the simple path, and add `login`, `logout` and `doctor` commands.
`login` tests IMAP and SMTP, then stores the password in the OS keychain through
`@napi-rs/keyring`, an optional dependency. The extension bundle leaves it out.

## Consequences

Developers can avoid plaintext passwords. The code carries one optional native module, loaded only
if it's present, and a machine with no keychain falls back to environment variables.

## Alternatives considered

- **Environment variables only**—less code, but the risk falls on the most exposed credential.
- **Shelling out to `security`, `secret-tool` and PowerShell**—three code paths instead of one.
