# Wiki conventions

The concrete shape of `wiki/` and `specs/`, referenced by `fl-pm` rather than hardcoded into
its workflow files—this is the single source of truth for the structure itself.

## Layout

```
wiki/
  Home.md                     nav landing page
  _Sidebar.md                 nav — the wiki's only other navigation surface
  CONTEXT.md                  domain language — every fuzzy term pinned
  prd/
    00-master-prd.md          vision, cross-module scope, links to every child PRD
    <module>.md               child PRD — one per module in Module skeleton below
    decisions/                Functional Decision Records (FDRs), dated
  architecture/
    00-architecture.md        the one architecture document — system shape, module boundaries
    decisions/                Architecture Decision Records (ADRs), dated
  plans/                      fl-pm's plan-folder mechanism — see fl-pm/plan.md
  reports/                    point-in-time review reports
specs/                        (top-level, not under wiki/) — exact technical contracts
  00-contracts.md             every contract held between two or more modules
  <module>.md                 one per module
```

## Module skeleton

One child PRD and one spec file per module listed in `.sdlc/sdlc-config.yml`'s `modules:`—
matching the repo's actual top-level directories. A **new top-level module** gets a new child
PRD and a new spec; a sub-capability *within* an existing module does not.

## File templates

**`prd/00-master-prd.md`**: Vision & Goals / Actors / Cross-Module Scope (in/out) / Success
Criteria / Links to child PRDs / Open Questions.

**`prd/<module>.md`**: Problem & Context / Actors & Goals / Functional Requirements (numbered) /
Business Rules / Decisions (links into `prd/decisions/`) / Non-Goals / Open Questions.

**`architecture/00-architecture.md`**: System overview / Module boundaries (links to
`specs/00-contracts.md` and each `specs/<module>.md`) / Cross-cutting concerns / Decisions
(links into `architecture/decisions/`) / Open Questions.

**`CONTEXT.md`**: the glossary. Every fuzzy term gets pinned the moment it appears in a
brainstorm, with the thing it is commonly confused with named explicitly. It is loaded into
every coder and reviewer subagent and it outlives any single feature.

## Decisions live next to what they decide

- A **functional** decision (a business rule, a scope call) → `wiki/prd/decisions/YYYY-MM-DD-<slug>.md`
  (FDR: Context / Decision / Consequences).
- An **architecture** decision (a technology or structural choice) →
  `wiki/architecture/decisions/YYYY-MM-DD-<slug>.md` (ADR: same shape).
- Write one only for decisions that are **hard to reverse, surprising, and a real trade-off**.
  Everyday choices don't need one.
- **Never delete a decision record.** A superseded one is marked
  `Superseded by [YYYY-MM-DD-<slug>]` and stays.
- Dates are absolute in every document, never relative.

## Technical contracts stay in `specs/`

`specs/` is the exact-contract layer—schemas, interfaces, file formats—that implementers
follow **blindly**. One file per module, plus the one cross-module file below, each keeping a
`Current State` section reconciled after every merge (see `fl-pm/reconcile.md`).

**`specs/00-contracts.md`** owns every contract that is bilateral or wider—held between two
or more modules, where filing it under one module's spec would wrongly imply that module owns
it: shared message envelopes, event vocabularies, cross-module key grammars, lifecycle state
machines, shared definitions. A module spec cites `00-contracts.md` by section id (`§C3`, `§C4`);
it never restates its content.

Every spec follows one skeleton:

```
1 · Purpose & boundary      — what the module owns; explicitly what it must not do
2 · External surface        — the exact contract, module-shaped
3 · Consumed & produced contracts — pointers into specs/00-contracts.md, not restatements
4 · Invariants              — numbered and module-prefixed (WEB-INV-1, API-INV-1, CTR-INV-1),
                             each individually testable
5 · Configuration           — env vars, ports, defaults
6 · Decisions               — links to the ADRs that bear on the module
7 · Current State           — every divergence, defect and surprise
```

Specs describe the system **as-built, never as-intended**—where code and design intent
differ, the code wins and the divergence goes in §7 with an ADR recording it. The body says
what the contract *is*, with short inline pointers (`(unreachable—see §7)`) rather than
caveats scattered through it.

## Diagrams are Mermaid

Fence diagrams with ```` ```mermaid ````. Mermaid renders natively in GitHub, in the mirrored
wiki, and in artifacts with no build step, so the diagram is visible everywhere the documentation
is read. Full guidance, and the reason this repository standardises on one tool, is in
`.sdlc/policies/writing-standards.md`.

## Links

Relative Markdown links, **with** the `.md` extension—`[the FDR](../decisions/2026-08-17-slug.md)`.
Never root-absolute (`/prd/...` leaves GitHub entirely) and never extensionless. This follows
from `wiki_sync` in `.sdlc/sdlc-config.yml`: `.github/scripts/flatten_wiki.py` rewrites these
for the mirrored GitHub Wiki (which has no directories in its URL space)—your job is only to
make them resolve on disk in `wiki/`.

**Never link out of `wiki/` with a relative path.** `flatten_wiki.py` only rewrites links that
resolve *inside* `wiki/`, so a `../../specs/api.md` survives into the mirrored wiki as a link to
nothing. Refer to `specs/` and other top-level paths as **code spans** (`` `specs/api.md` ``), or
use a full `https://github.com/<owner>/<repo>/blob/<branch>/specs/api.md` URL when the reader
genuinely needs to click through.

## Ownership

`wiki/_Sidebar.md` and `wiki/Home.md` are the wiki's only navigation. A new PRD, FDR, ADR,
plan, or report **is not finished until it is listed there**.
