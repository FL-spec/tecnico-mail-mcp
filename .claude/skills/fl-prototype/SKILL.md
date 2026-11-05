---
name: fl-prototype
description: >
  Build throwaway code that answers a design question — whether a state model, data shape, or
  layout is right — then keep the answer and delete the code. Invoked by fl-flow, or when the
  user types /fl-prototype.
routed-by: fl-flow
---

# Prototype

A prototype is **throwaway code that answers a question**. The question decides the shape, and
the answer is the only thing that survives.

## The worktree

A prototype lives in its **own worktree**, like any other development, and is discarded when
it's no longer needed. **It never merges to the default branch.**

Read `.sdlc/sdlc-config.yml` at the repo root for `prototype.{worktree_path,branch}` and
`default_branch`, then:
```bash
git worktree add <prototype.worktree_path> -b <prototype.branch> <default_branch>
cd <prototype.worktree_path> && <the module's install command>
```
Everything the prototype builds stays on that branch. Because nothing there is bound for the
default branch, **the repo's conventions don't apply inside it** — that freedom is the point.

**What survives the worktree is only ever an answer, never the code that produced it:**
- **The verdict** → `/fl-pm`, which records it in the work item's detail file.
- **A validated design** — the chosen UI option, the confirmed state model — → `specs/` and/or
  `wiki/` through `/fl-pm`, so the decision outlives the branch.
- **Real code** is written later, from an issue, through `/fl-implement`. Prototype code is
  never promoted; it was built under prototype constraints and it stays behind.

Keep the worktree while it's still teaching you something. Once it isn't:
`git worktree remove <prototype.worktree_path>` and let the branch go.

## Pick a branch

Identify the question — from the user's prompt, the surrounding code, or by asking if the user
is around:

- **"Does this logic, state model, or data shape feel right?"** → [LOGIC.md](LOGIC.md). A tiny
  interactive terminal app that pushes the model through cases that are hard to reason about
  on paper.
- **"What should this look like?"** → [UI.md](UI.md). Several radically different variations on
  one route, switchable from a floating bar.

The branches produce very different artifacts, so a wrong pick wastes the whole prototype. If
the question is genuinely ambiguous and the user isn't reachable, default by where the code
lives — a service, model, or storage question → logic; a page or component → UI — and state
the assumption at the top of the prototype.

## Rules for both

1. **One command to run.** A single documented command from the worktree, or a `Makefile`
   target. The user starts it without thinking.
2. **No persistence, and never the real store.** State lives in memory.
3. **Skip the polish.** No tests, no error handling past what makes it runnable, no
   abstractions. Learn fast; the branch is going away.
4. **Surface the state.** After every action, or on every variant switch, show the full
   relevant state so the change is visible.

## When done

Capture the **answer** and the question it answered, and hand both to `/fl-pm`. If the user is
around, that's a quick conversation about what the session taught them; if not, leave it in a
`NOTES.md` on the branch to be filled in before the worktree goes.

A design the answer settles — the winning UI variant, the validated state model — goes to
`wiki/` and/or `specs/` via `/fl-pm` in the same pass. That's what makes the prototype
disposable: once the decision is written down somewhere permanent, the code that produced it
has no reason to survive.

**Handoff:** "Prototype answered: <the verdict>. Next: `/fl-pm` to record it and write the
validated design into `specs/`. Then `git worktree remove <path>`."
