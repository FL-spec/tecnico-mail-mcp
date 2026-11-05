# Coding standards

Repo-specific conventions the `fl-*` skills bind to. This is the **single source of truth**
for them—a skill points here rather than repeating any of this inline, and every coder and
reviewer subagent reads it before writing a line.

`/fl-bootstrap` fills in the bracketed sections from your answers. Keep it current: a
convention that lives only in your head is one the agents break.

## Shape

> One row per module in `.sdlc/sdlc-config.yml`'s `modules:` list.

| Module | Stack | Role |
|---|---|---|
| `[web/]` | `[TypeScript · Next.js]` | `[what it owns]` |

## Stack conventions

> Per module: the libraries that are already the answer, so an agent extends the existing
> pattern instead of introducing a second library for the same job. Be specific—"use the
> existing patterns" is not a convention, "`zod` for schema validation, never `yup` or hand-rolled
> guards" is.

- **`[module]`**—`[linter + config: e.g. eslint, or ruff line-length 100 target py312 rules E F I UP N C B]`.
  `[logging]`, `[schema/validation]`, `[data access]`. `[Anything a new file must follow.]`

## Configuration and secrets

- Config and credentials come from environment variables or a gitignored `.env` only.
- Every module reads its own settings module; validate env at startup and fail loudly.
- `[Name the settings module per module.]`

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

> Tracked here rather than silently worked around, because fixing them is an app-code or
> infrastructure change, not a doc change. A gate that is a `TODO` in `sdlc-config.yml` gets
> a line here, and a subagent that hits one reports it rather than treating it as passed.

- _(none yet)_

## Gotchas

> Appended during builds. Real, surprising things that bit us—not general advice.

- _(none yet)_
