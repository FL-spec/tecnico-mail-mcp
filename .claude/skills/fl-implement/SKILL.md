---
name: fl-implement
description: >
  Run the implementation loop for one GitHub issue, or a batch of them in one worktree and one
  PR: feasibility gate, a coder subagent in a worktree, a reviewer subagent (max 3 rounds), a PR
  that closes the issue, then the feedback loop that drives every review comment to resolved.
  Requires gh auth and a planned issue. Invoked by fl-flow, or when the user types
  /fl-implement <issue#>.
routed-by: fl-flow
---

# Implement Loop

You are the **orchestrator**, in the main thread. You drive one GitHub issue to a merge-ready
PR by delegating to two subagents. You delegate, gate, and report — **the code and tests are
theirs to write.**

**The briefs** live beside this file: `coder.md` and `reviewer.md` for the subagents (you pass
a subagent the absolute path and tell it to follow that file — **you never read them
yourself**), and `pr-feedback.md`, which you read yourself at step 8.

**More than one issue in the input** — a range, a list, or a set description — is **batch
mode**. Read `batch.md` beside this file and follow it: it plans the set, resolves the
dependency order, and runs the loop below once per issue in one shared worktree, ending in one
PR. The rest of this file still binds; `batch.md` only says what differs.

## Configuration

Read `.sdlc/sdlc-config.yml` at the repo root (`git rev-parse --show-toplevel`) first and take
every value below from it:
- `github.{owner,repository,slug}` — every board and `gh api` call.
- `github.project.enabled` and, when true, `github.project.{number,id,status_field_id}` and
  `github.project.statuses.*`.
- `default_branch` — what worktrees branch from and PRs target, written `<default_branch>` below.
- `implement.{worktree_path,branch}` — path and branch-name templates, `{issue}` and `{slug}`
  substituted.
- `implement.max_changed_loc` — the feasibility gate's size ceiling.
- `modules` and `quality_gates.*` — the per-module commands the subagents run (see "Which gates
  to run").

**A value still in `<ANGLE BRACKETS>`, or an empty `quality_gates`, means the repo was never
bootstrapped.** Stop and send the user to `/fl-bootstrap`.

**Board move**, used verbatim at steps 2 and 7 with a different status each time, and **skipped
entirely when `github.project.enabled` is false**:
```bash
item_id=$(gh project item-add <project.number> --owner <github.owner> \
  --url https://github.com/<github.slug>/issues/<NNN> --format json --jq '.id')
gh project item-edit --id "$item_id" \
  --project-id <github.project.id> \
  --field-id <github.project.status_field_id> \
  --single-select-option-id <github.project.statuses.<STATUS>>
```
(`item-add` is idempotent. Re-read the config if a call 404s — recreating the project changes
the IDs.)

**Token scope fallback.** `gh project` calls need `read:project` + `write:project`. When the
active token lacks them the call fails with `missing required scopes [read:project]`; fall back
to the PAT in `~/.config/gh/hosts.yml` and continue silently:
```bash
export GH_TOKEN=$(grep oauth_token ~/.config/gh/hosts.yml | head -1 | awk '{print $2}')
```
If that also fails, report it once, continue without the board move, and point the user at
`gh auth refresh -s read:project,write:project`.

## Which gates to run

`quality_gates.*` is **per module**, because modules can be independently deployed with their
own toolchains. Before spawning the coder or reviewer, determine which module(s) the issue's
changed files fall under (from `modules:` in the config) and **pass that block**. A change
touching two modules, or a shared root test suite, also needs `quality_gates.integration` if
one is defined. A gate whose command is a `TODO` placeholder (see
`.sdlc/policies/coding-standards.md` "Open gaps") is **said so explicitly in the report** rather
than silently skipped.

## Inputs

An issue number (from `$ARGUMENTS`, e.g. `/fl-implement 7`); if missing, list open issues
(`gh issue list`) and ask which one. Requires `gh` authenticated, the issue present with the
standard template (from `/fl-pm`), repo root, clean tree.

**Several issue numbers** — `#12 to #17`, `#12, #14, #17`, or a named set — go to `batch.md`
first, then back here per issue.

**Entering at step 8.** A PR number instead of an issue number — or a request to handle the
review comments on an open PR — skips straight to step 8's feedback loop. Resolve the issue
number from the PR body's `Closes #<NNN>` for the board move.

## Loop

### 1. Feasibility & scoping gate
Play the `spec-analyst` role (`.agents/roles/spec-analyst.md`): audit the issue against the
current codebase — read the issue, the specs it
references, and the affected module's code. Is it one vertical slice within
`implement.max_changed_loc` including tests? Are the Acceptance Criteria testable? Are the
referenced `specs/<module>.md` contracts complete and current?

**Feasible** → continue. **Too big or under-specified** → propose a split (or a `/fl-pm`
re-slice), tell the user, and **stop**. Run this gate on every issue, including the ones that
look small.

### 2. Read, confirm, start
- `gh issue view <NNN>` — Summary, Vertical Slice, Implementation Tasks, Acceptance Criteria,
  Depends On, Technical Notes.
- An **unclosed issue in `Depends On`** → stop and tell the user.
- Confirm the plan with the user before creating a worktree, **only if** there's a real risk of
  misalignment, ambiguity, missing information, or too many lines of code. If they confirm,
  continue; if they don't, **stop**.
- Board move → `in_progress`.

### 3. Worktree
```bash
git worktree add <implement.worktree_path> -b <implement.branch> <default_branch>
```
All subsequent work happens on that path and branch.

### 4. Implement — slice-implementer subagent
Spawn the `slice-implementer` subagent (canonical role: `.agents/roles/slice-implementer.md`; use
`subagent_type: slice-implementer`, or `general-purpose` if that agent isn't available). Its
prompt: **read `<this skill's directory>/coder.md` and follow it**, with the issue number, the
worktree path, the relevant spec excerpts, and the quality-gate block(s) resolved above. Relay
its summary — files changed, tests added, gate results. A reported blocker or ambiguity →
surface it to the user and stop.

### 5. Review — reviewer subagent (max 3 rounds)
Spawn the `reviewer` subagent (canonical role: `.agents/roles/reviewer.md`) whose prompt is:
**read `<this skill's directory>/reviewer.md` and follow it**, for issue #NNN, round R, in the worktree, with the same quality-gate block(s).
It returns a verdict, findings, and a PR description draft.
- **CHANGES REQUESTED or a failing gate**, rounds 1–2 → relay the blocking findings, re-spawn
  the coder subagent with them (same worktree and branch), re-review at round + 1.
- **Round 3 still failing** → **stop and escalate**: report branch, issue number, and findings.
  No push, no PR.
- **APPROVED** → continue, carrying NON-BLOCKING notes into the PR body.

### 6. Check off the issue's Implementation Tasks
Closing an issue from a PR does not tick plain checklist lines — only native sub-issue links do
that. Do it explicitly, **before** opening the PR:
- `gh issue view <NNN> --json body -q .body` for the current body.
- Compare what was actually built (the coder's summary, plus any fix rounds) against each
  `- [ ]` line under **Implementation Tasks**, and flip the completed ones to `- [x]`. Check
  only what is genuinely done — anything descoped or deferred stays unchecked, with the reason
  noted in the PR body.
- Write the whole body back — `gh issue edit <NNN> --body "<full updated body>"` — there is no
  partial-edit flag. A short inline script does the `- [ ]` → `- [x]` swap on the exact matched
  lines, where a broad find/replace would hit unrelated text.
- Verify with a second `gh issue view <NNN> --json body -q .body` that the boxes landed.

### 7. PR (do not merge)
- Commit in the worktree (repo commit conventions — see `.sdlc/policies/coding-standards.md`),
  push, and open the PR with the reviewer's draft body:
  ```bash
  gh pr create --base <default_branch> --head <implement.branch> --title "<title>" \
    --body "<body incl. 'Closes #<NNN>', quality-gate overview>"
  ```
- Board move → `in_review`, once, right as the PR opens.
- Tell the user the PR is open and **stop**. Reviews now happen on GitHub — Copilot,
  CodeRabbit, or a `/fl-pr-review` run. **Never auto-merge.**

### 8. PR feedback loop (only when the PR draws review comments)
Read `pr-feedback.md` beside this file and follow it: triage every open review comment,
delegate the confirmed fixes to the coder subagent, then reply to and resolve every thread.
This step owns the board while the PR is under review — triage is the first point that knows
which findings are real, so it decides whether the issue drops back to `in_progress` or stays
at `in_review`.

A PR nobody comments on skips this step entirely.

### 9. After the user merges
- `git worktree remove <implement.worktree_path> 2>/dev/null || true` (idempotent — `/fl-pm`'s
  post-merge duty removes it too, so either order is safe).
- Hand off to `/fl-pm` post-merge duty: update `specs/<module>.md` §7 Current State, close the
  issue if the PR didn't, remove the worktree, board → Done, unblock dependents.

## Rules
- One issue per run, unless `batch.md` is driving — then one issue at a time, in dependency
  order, on one shared branch. Respect `Depends On` either way.
- Code, tests, and specs are the **subagents'** work — delegate.
- The review gate **always** runs; a PR opens only on a green suite and green gates for every
  module the change touches.
- **Never merge.** Stop on any unresolved blocker and report clearly.

## Handoff

At every stop, print: what happened, the branch and PR URL if one exists, and the next command
— `/fl-implement <PR#>` for a PR with comments, `/fl-pr-review <base>` for a deeper review, or
`/fl-pm` post-merge once it's merged.
