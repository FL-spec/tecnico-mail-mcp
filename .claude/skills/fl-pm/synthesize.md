# Synthesize — planning session → docs

Turn a finished planning session into durable documentation. Input: the session conversation
in context, or a topic the user points at. Read `.sdlc/policies/wiki-conventions.md` first for
the exact file templates and decision placement — this file says only what changes for a
synthesize pass.

**Audit against the codebase before writing.** Check the actual modules and storage first — a
document that contradicts the code is worse than no document. This is the `spec-analyst` role
(`.agents/roles/spec-analyst.md`): find ambiguity, missing observable acceptance criteria, hidden
scope, conflicting requirements and affected invariants, and separate real human decisions from
assumptions the repository already settles.

## 1. Domain language → `wiki/CONTEXT.md`

Every fuzzy term the session pinned goes in the glossary **first**, with the thing it is
commonly confused with named explicitly. The PRD and the spec you're about to write must use
those exact terms. A term that only got pinned in conversation is a term the next coder
subagent will get wrong.

## 2. Functional conclusions → `wiki/prd/`

Update the relevant child PRD (`wiki/prd/<module>.md`, one per module in
`.sdlc/sdlc-config.yml`) or `wiki/prd/00-master-prd.md` for anything cross-module, keeping the
existing template sections. Significant business decisions get a dated FDR at
`wiki/prd/decisions/YYYY-MM-DD-<slug>.md` (Context / Decision / Consequences), linked from the
PRD's Decisions section.

## 3. Technical decisions → `specs/`

Update the affected `specs/<module>.md`, keeping its seven-section skeleton — especially
**§4 Invariants** (numbered, module-prefixed, each individually testable) and **§7 Current
State**. A contract held between two or more modules goes in `specs/00-contracts.md` instead,
cited from each module spec by section id, never restated.

If the decision changes the system's shape rather than one module's contract, also update
`wiki/architecture/00-architecture.md`. Significant architecture choices get a dated ADR at
`wiki/architecture/decisions/YYYY-MM-DD-<slug>.md`.

## 4. Navigation

Add every new PRD, FDR, ADR, spec, and report to `wiki/_Sidebar.md` and `wiki/Home.md`. A doc
that isn't linked doesn't exist.

## 5. Stop

Report what you wrote and **stop for the user to review.** Issues are outward state; they get
created only once the user has read these docs and said go.

On that confirmation, read `issues.md` beside this file and follow it.

**Handoff:** "Docs written: `<files>`. Read them, then say go and I'll cut the issues
(`create-issues`)."
