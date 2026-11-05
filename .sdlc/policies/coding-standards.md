# Coding standards

Repo-specific conventions the `fl-*` skills bind to. This is the **single source of truth**
for them—a skill points here rather than repeating any of this inline, and every coder and
reviewer subagent reads it before writing a line.

Keep it current: a convention that lives only in your head is one the agents break.

## Shape

| Module | Stack | Role |
|---|---|---|
| `src/` | TypeScript, Node 22 or later, ESM | the MCP server and its command line |

## Stack conventions

- **`src/`**: Biome for lint and format (`biome.json`), `tsc` in strict mode for types, Vitest for
  tests, esbuild for the build.
- `imapflow` for IMAP, `nodemailer` for SMTP and message building, `mailparser` for MIME, and
  `html-to-text` for HTML. `zod` for tool input schemas. Don't add a second library for any of
  these jobs.
- Log to stderr only, through `src/log.ts`. Stdout belongs to the MCP protocol.
- Errors that reach a user are `MailError` from `src/errors.ts`, with a cause, plus a next step.

## Configuration and secrets

- Settings come from environment variables, then the user's config file, in `src/config.ts`.
- The password comes from an environment variable or the OS keychain. It never reaches a file,
  a log line or an error message.

## Commits

`type(scope): imperative summary`, lowercase, scope optional—`feat(api): add candidate
endpoint`, `fix(worker): drop duplicate offsets`, `docs: ...`. Match what is already in
`git log` over what is written here if the two ever diverge.

## Non-negotiables

- **No secrets in code**—env vars or gitignored config only.
- **No dead code, no debug prints, no `TODO`/`FIXME`/placeholder** left in a merged change.
- **Never weaken, skip, or delete a test to make it pass.**
- **Ask before adding a dependency.** Treat all external input as untrusted.
- Every quality gate in `.sdlc/sdlc-config.yml` for the modules a change touches must be
  green before a PR opens.
- **A pull request that changes behaviour a spec describes MUST update that spec, and any
  ADR it invalidates, in the same PR.** `specs/` is followed blindly by implementers and by
  `/fl-implement`; a spec that lags a merged change is worse than no spec, because the next
  implementer trusts it. Deferring the update to a later reconciliation pass guarantees a
  window in which the spec is wrong—and that window is exactly when someone is building on
  it. The trigger is checkable, not a matter of judgement: if a change touches behaviour
  described in `specs/<module>.md` §2 (External surface), §4 (Invariants), or
  `specs/00-contracts.md`, the spec update is part of the change.

## Documentation

Prose in `wiki/`, `specs/`, and the root documents follows
`.sdlc/policies/writing-standards.md`, enforced by Vale in CI. Diagrams are Mermaid.

## Testing

- TDD, one behavior at a time: RED → GREEN → REFACTOR.
- Every test exercises the **public interface** and reaches data stores through it, so it
  survives internal refactors.
- The affected test file runs in-loop; the full gate block runs once before commit.
- E2E covers the critical path only.

## Open gaps

- Nothing tests against a real Técnico mailbox in CI, because that needs a real password. Run
  `tecnico-mail-mcp doctor` by hand before each release.

## Gotchas

- An `ImapFlow` instance can't be reused after it closes, and a missing `error` listener crashes
  the process. `src/imap/session.ts` owns both rules, so no other file creates a client.
