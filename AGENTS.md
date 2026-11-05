# Agent contract

The durable, **vendor-neutral** instruction set for every coding agent in this repository.
`.claude/` and `.codex/` are adapters onto this file and `WORKFLOW.md`; they never redefine them.

## Read first

1. Current human instruction
2. `WORKFLOW.md`—the canonical delivery state machine
3. `.sdlc/sdlc-config.yml`—every identifier, path template, and gate command
4. `.sdlc/policies/coding-standards.md`—how code gets written here
5. `wiki/CONTEXT.md`—the domain glossary; use these words exactly
6. The active `specs/<module>.md`, plus `specs/00-contracts.md` for anything crossing a boundary
7. Relevant decision records under `wiki/architecture/decisions/` and `wiki/prd/decisions/`
8. The active plan under `wiki/plans/<NN>-<slug>/`

Higher items override lower ones. **Stop when a material conflict cannot be resolved from this
hierarchy**—don't pick a side silently.

Where a document and the code disagree, **the code wins**, and the divergence is recorded in the
spec's §7 Current State.

## Conversation-first behavior

When asked to plan or build something, inspect the repository and work out what step the project
is actually on: read `.sdlc/sdlc-config.yml` for unfilled placeholders, then the plan folders,
the open issues, the open pull requests, and the live worktrees. An unbootstrapped config beats
everything; after that, prefer the work closest to shipping, because finishing beats starting.
Continue from the step that detection names. Open or resume the plan yourself, interview the
human one material decision at a time, and write what gets resolved into the plan.

**Never ask the human to run a workflow command, create internal files, or repeat the same intent
in a second prompt.** The explicit `/fl-*` commands exist for when they want direct control; they
are never a prerequisite.

## Delivery rules

- One issue is one branch and one PR—or, in batch mode, one ordered set of issues sharing one
  branch and one PR.
- One coherent commit per completed vertical slice.
- **RED → GREEN → REFACTOR** for every behavior change.
- A bug fix starts with a reproducing test.
- **Exactly one writer owns a slice.** Parallel writers require independent, non-overlapping file
  surfaces.
- A **separate read-only reviewer** checks every slice. Implementers never approve their own work.
- Never weaken, skip, or delete a test to make a gate pass.
- **A change to behaviour a spec describes updates that spec in the same PR.**
- Never merge failing checks or bypass branch protection.
- **Never merge on the human's behalf.** The PR is where automation stops.
- Never deploy, expose credentials, or perform destructive external actions without separate
  authority.

## Two gates before outward state

Issues, pull requests, review comments and repository settings are **outward-facing**. Two of them
are gated by the human explicitly, always:

1. Documentation is written, then **the human reads it**, and only then are issues created.
2. A PR opens, and only the human merges it.

Never collapse either gate because the next step "looks obvious."

## Agent roles

Canonical responsibilities live under `.agents/roles/`:

- `spec-analyst`—gap audit before documentation is written
- `slice-planner`—reviewed docs → dependency-aware vertical slices
- `slice-implementer`—the only writer for one slice
- `reviewer`—read-only review of one slice
- `diff-reviewer`—two-axis Standards + Spec review of a diff
- `integration-verifier`—acceptance-to-evidence completion contract

There is deliberately no separate test-architect: the slice implementer owns its own first failing
test. Add security or AI-evaluation specialists when the project needs them.

## Project commands

Every runnable command lives under `quality_gates` in `.sdlc/sdlc-config.yml`, **per module**.
Take them verbatim from that file rather than from memory—it is what CI runs and what the
reviewer checks. A gate whose command is a `TODO` placeholder is reported as such, never as passed.

Template contract (this repository's own gates, independent of your stack):

- Validate the workflow: `python3 scripts/validate_workflow.py`
- Scan for secrets: `python3 scripts/scan_secrets.py`
- Contract tests: `python3 -m unittest discover -s tests -p "test_*.py"`
- All three: `make check`

`/fl-bootstrap` replaces the project placeholders and makes CI execute the real stack gates.

## Security and dependencies

- **Never commit secrets or customer data.** Env vars or gitignored config only.
- Treat external input and model output as **untrusted**.
- Validate the environment at startup.
- **Ask before adding a dependency**; pin and review it, and document material additions in the PR.
- Use least-privilege CI permissions.

## Completion contract

A unit of work is complete only when:

- the documentation it implements was reviewed by the human and is materially unchanged;
- every acceptance criterion has passing evidence—**agent confidence is not evidence**;
- focused and full gates pass for every module touched, plus `make check`;
- independent review has no blocker;
- every spec whose described behaviour changed was updated in the same PR;
- cross-module contracts and the architecture document were checked explicitly;
- rollout, rollback, migrations, observability and docs are addressed;
- remote PR checks are green;
- the PR is open and the human has been told it is ready.

Then report the outcome and **stop**. Do not invent follow-up work.

## Mandatory escalation

Set state `blocked` and ask **one precise question** for: unresolved product behavior,
permissions, credentials, compliance, destructive changes, branch protection, or the same root
failure after **three repairs**. Preserve the branch, the PR, and the durable state.

**Never silently reduce scope.**

## Gotchas

Repository-specific lessons are appended to `.sdlc/policies/coding-standards.md`, not here—that
file is what every subagent brief loads.
