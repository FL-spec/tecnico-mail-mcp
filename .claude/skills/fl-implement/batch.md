# Batch mode — several issues, one worktree, one PR

You are still the orchestrator in the main thread, running the same loop as `SKILL.md`. What
changes: the issues are planned as a **set** before any code is written, they are implemented
**sequentially in dependency order** in **one shared worktree**, and they land in **one PR**
that closes all of them.

Everything `SKILL.md` says about configuration, subagents, quality gates, board moves, and the
token-scope fallback still binds. This file only says what is different.

## When this file applies

The input names more than one issue: a range (`#12 to #17`), a list (`#12, #14, #17`), or a set
description ("the remaining issues of plan 03"). One issue → `SKILL.md` alone, unchanged.

Every issue in a batch must belong to **the same repository** — one PR cannot close issues in
another repo.

## 0. Batch plan — before any worktree exists

This step replaces `SKILL.md` steps 1 and 2 for the whole set. It ends in **one** confirmation
from the user, not one per issue.

**Resolve the set.** Expand ranges against reality, never blindly:
`gh issue list --state all --json number,title,state` over the range. A number that does not
exist, is already closed, or sits in another repo is reported, not silently implemented.

**Read every issue.** `gh issue view <NNN>` for each — Summary, Vertical Slice, Implementation
Tasks, Acceptance Criteria, **Depends On**, Technical Notes. Record each issue's goal in one
line and its rough size.

**Build the dependency graph** over the set, from the `Depends On` fields plus what you can see
of real coupling (two issues editing the same module in an order that matters).

- Dependency **inside the set** → an ordering edge. Nothing else to decide.
- Dependency **outside the set, already closed** → satisfied. Note it and move on.
- Dependency **outside the set, still open** → an unresolved external dependency. **Never start
  such an issue.** Decide it explicitly:
  - the open dependency is in the same repo, is Ready, and is small → **propose pulling it into
    the batch**, at the front of the order;
  - otherwise → **propose dropping the dependent issue together with every issue in the set
    that transitively depends on it**, and running the rest.

  Ask the user once, in a **single batched question** covering all such cases, with your
  recommendation stated per case. Do not resolve one silently because it "looks harmless".
- A **cycle** → stop. Report the cycle and hand it back to `/fl-pm` to re-slice.

**Order the set.** Topological sort of the graph. Break ties by ascending issue number unless
the user gave an explicit order. Where two independent issues touch the same files, place them
adjacent, so the later one builds on code that is already in the branch.

**Feasibility gate each issue** (`SKILL.md` step 1) — `implement.max_changed_loc` applies **per
issue**, never to the batch total. An issue that fails the gate is dropped with its dependents,
or the batch stops; fold that choice into the same batched question.

**Present the batch plan and wait for the go-ahead**: the ordered issue list with one line each,
the dependency edges, anything added or dropped and why, the per-issue size estimates, and the
branch and worktree names you will use. This confirmation is the only one before code — after
it, the batch runs to the end without asking again, except where a decision below says otherwise.

## 1. One worktree, one branch

`implement.worktree_path` and `implement.branch` are per-issue templates. Derive the batch names
from them by substituting `{issue}` with `<first>-<last>` for a contiguous range, or
`<first>+<count>` for a scattered set, and `{slug}` with a slug naming the **shared goal** — not
one issue's title:

```bash
git worktree add .worktrees/issue-12-17 -b 12-17-<batch-slug> <default_branch>
```

Create it once, at the start. Every issue in the batch is implemented on that path and branch.

## 2. Per issue, in order

For each issue, in the confirmed order:

1. **Board move → `in_progress`** for that issue only.
2. **Coder subagent** per `coder.md`, in the shared worktree. Beyond its normal brief, tell it:
   which issues of the batch **already landed on this branch and at which SHAs**, that their
   code is **done and not to be redone or reverted**, and that it must build on it. Give it the
   spec excerpts for its own issue only.
3. **Reviewer subagent** per `reviewer.md`, max 3 rounds, exactly as in `SKILL.md` — but scope
   its diff to **this issue's change**: `git diff <previous issue's commit>..HEAD`, and
   `<default_branch>..HEAD` for the first issue. The reviewer judges one issue against one set
   of acceptance criteria, never the whole branch.
4. **Check off the Implementation Tasks** on that issue (`SKILL.md` step 6).
5. **Commit** — one commit per issue, its message naming the issue and what it built. Push the
   branch after each commit, so a crash mid-batch loses nothing. **Do not open the PR yet.**
   Record the commit SHA: it is the review boundary for the next issue.

The full quality-gate suite must be **green at every issue boundary**. A later issue never
starts on a red branch — that is what makes a per-issue review boundary meaningful.

## 3. When one issue fails

Three review rounds still failing, or a coder-reported blocker:

- **Keep the branch green.** `git branch batch-failed-<issue> HEAD` to preserve the attempt,
  then `git reset --hard <last good SHA>` so the branch holds only completed issues.
- **Skip that issue and every issue in the batch that depends on it.** Continue with the
  independent remainder. Stop the batch entirely only when nothing independent is left.
- Leave the failed issue's board status at `in_progress` — it is not in review and not done.
- Report the failure inline as it happens, then keep going. Do not wait for an answer mid-batch;
  the decision rule above already covers it.

An issue skipped this way **never gets a `Closes` line** in the PR body.

## 4. One PR at the end

- Push, then open a **single** PR against `<default_branch>`.
- **Title** names the shared goal, not one issue.
- **Body** carries:
  - one `Closes #<NNN>` line for **each** issue that actually landed, and none for a dropped or
    failed one;
  - a short section per issue — what changed, tests added, non-blocking notes from its review;
  - the batch quality-gate results, run once on the final branch state;
  - a **Not included** section listing every dropped, skipped, or failed issue with the reason
    and its preserved `batch-failed-<issue>` branch, if any.
- **Board move → `in_review`** for every issue the PR closes, once, as the PR opens. Dropped and
  failed issues do not move.
- Tell the user and stop. **Never merge.**

## 5. PR feedback loop

`pr-feedback.md`, run **once for the whole PR**, with one addition: map each review comment to
the issue that owns it — the file it touches plus which issue's commit introduced the line
(`git blame` against the recorded per-issue SHAs). That mapping decides two things: the reply
names the right issue, and the board move at triage applies **only to the issues implicated by
confirmed findings**, not to the whole set.

## 6. After the user merges

Remove the shared worktree once, then hand off the whole set to `/fl-pm`'s post-merge duty in a
single call, listing every issue the PR closed plus everything left behind. Report one paragraph
covering the batch: what landed, what did not, and which dependents are now unblocked.

## Rules
- One issue is never split across two PRs, and a PR never opens with zero `Closes` lines.
- `implement.max_changed_loc` is a **per-issue** ceiling; a batch has no ceiling of its own.
- Dependency order wins over the order the user typed.
- No issue starts while a dependency of it is open.
- Issues from different repos never share a batch.
