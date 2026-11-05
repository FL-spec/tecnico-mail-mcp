# Architecture

> Seeded by `/fl-bootstrap` from the modules as they actually are, kept current by `/fl-pm`.
> This describes the system **as-built**. Where it and the code disagree, the code wins.

## System overview

_[The shape of the system in a paragraph, and a diagram if it earns its place.]_

## Module boundaries

> One row per module. The exact contracts are in `specs/`—link, never restate.

| Module | Owns | Spec |
| --- | --- | --- |
| _(module)_ | _(responsibility)_ | `specs/<module>.md` |

Contracts held between two or more modules live in `specs/00-contracts.md` (top-level, outside
`wiki/`—see the link rule in `.sdlc/policies/wiki-conventions.md`).

## Cross-cutting concerns

_[Logging, config, auth, error handling, observability—whatever actually spans modules.]_

## Decisions

> Links into `architecture/decisions/`. Superseded ADRs stay listed, marked as superseded.

- [2026-09-07—Single entry point and two delivery lanes](decisions/2026-09-07-single-entry-two-lanes.md)

## Open Questions

- _(none yet)_
