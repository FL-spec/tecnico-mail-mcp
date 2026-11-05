# Reconcile — post-merge state and backlog

Two entry points that interlock: the post-merge pass runs the triage as its last act.

## Post-merge (called from `/fl-implement` step 9, or on demand)

This is the `integration-verifier` role (`.agents/roles/integration-verifier.md`): map every
acceptance criterion to concrete evidence in the plan's `acceptance.md`, and record the exact
commands and results in its `verification.md` (templates in `wiki/plans/_template/`).
**Agent confidence is not evidence.**

After an issue's PR merges:

1. `git diff` review of what actually landed.
2. Update the **§7 Current State** section of the affected `specs/<module>.md` file(s).
3. Close the issue if the PR didn't: `gh issue close <NNN>`.
4. Remove the issue's worktree and prune stale metadata:
   ```bash
   git worktree remove <implement.worktree_path> 2>/dev/null || true
   git worktree prune
   ```
5. Board move → `done` (skipped when `github.project.enabled` is false).
   Then walk up the issue's parents (`gh api graphql` → `issue(number:N){parent{number}}`). For
   each parent whose sub-issues are now all closed: tick its checklist, close it, and board move
   → `done` — unless it is a plan epic and the plan is not yet `complete`, in which case leave it
   open. When a plan is marked `complete`, close its epic in the same pass.
6. Run the triage below to unblock dependents.
7. Report a one-paragraph summary, including any issues just moved to Ready.

**Cross-module contracts have no single issue owner — check them explicitly.**
`/fl-implement` naturally updates the *module* spec an issue targets, but a change can shift
the shape *across* modules — a new or changed contract between modules, or the system-level
shape in `wiki/architecture/00-architecture.md` — and those drift silently otherwise. On every
merge, ask: **did this change what one module exposes to another** (a new event schema, a new
API route, a new table another module reads)? If so, update the affected `specs/<module>.md`
§7 and `specs/00-contracts.md`, and — if the system shape itself changed —
`wiki/architecture/00-architecture.md`, in this same pass. Flip planned→shipped markers, and
delete "planned (#N)" notes once #N has merged.

Any term the merged change introduced or redefined goes into `wiki/CONTEXT.md` here, not later.

## Backlog triage (on demand, or step 6 above)

1. Find every open issue whose `Depends On` references recently closed issues:
   ```bash
   gh issue list --search "#<NNN> in:body" --state open --json number,title,body
   ```
   For each, read its full `Depends On` line and check every listed issue's state
   (`gh issue view <dep#> --json state -q .state`):
   - **All dependencies closed** → board move → `ready` (or, with no board, say so explicitly
     in the report — that report *is* the ready queue). Report "unblocked".
   - **Any still open** → leave at Backlog, naming which ones still block it.

   Every dependent the search returned is accounted for — moved, or explicitly left with a
   reason.
2. Report the full newly-Ready list with one-line summaries.

## "What should I work on next"

Rank the Ready issues by:
1. **Unblocked** — no open `Depends On`.
2. **Plan alignment** — an item whose plan is `active` before one whose plan is `parked`;
   earlier phase before later.
3. **Estimated size** — at or under `implement.max_changed_loc` preferred.

Present the ranking with a one-line rationale per pick, and ask the user to confirm or
override.

**Handoff:** "Ready queue: #N, #P, #Q. Recommended next: implementing #N — <one-line reason>
(`/fl-implement <N>` to run it directly)."
