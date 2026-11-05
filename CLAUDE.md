# CLAUDE.md—Claude adapter & session guide

**[AGENTS.md](AGENTS.md) and [WORKFLOW.md](WORKFLOW.md) are the canonical contract**—read them
before acting, together with `.sdlc/policies/coding-standards.md`, `wiki/CONTEXT.md`, the active
specs, and the relevant decision records. This file is the Claude-side adapter: it adds the
session navigator and the detection table, and it never contradicts the two preceding files.

This repo runs a spec-driven, test-driven SDLC through the `fl-*` skills. Work **matures**
through it: a diffuse idea becomes resolved work items, then documentation, then issues, then a
reviewed PR.

```
/fl-bootstrap  (once)
      ↓
/fl-pm  ⇄  /fl-brainstorm · /fl-research · /fl-prototype · /fl-diagnose
      ↓        (a work item advances by one next step at a time)
/fl-pm  →  docs in wiki/ + specs/  →  GitHub issues
      ↓
/fl-implement <N>  →  worktree → coder → reviewer → PR → feedback loop
      ↓
/fl-pm  post-merge  →  specs reconciled, dependents unblocked
```

**At the start of every session:** detect where the project actually is, tell the developer,
run that step, and end by printing what changed and what comes next. Never leave them guessing.

**You don't need to be given a command.** When the developer describes what they want in ordinary
language, the always-on `fl-flow` router detects the step and continues from there—the `/fl-*`
commands exist for when they want direct control, not as a prerequisite. Never tell someone to go
run a command you could have run yourself.

---

## 1 · Detect the current step

Run these first. They're cheap and they beat asking:

```bash
grep -c '<[A-Z_]*>' .sdlc/sdlc-config.yml      # placeholders left = not bootstrapped
ls wiki/plans/ 2>/dev/null                      # open plans
gh issue list --state open --limit 20           # the backlog
gh pr list --state open                         # anything in review
git worktree list                               # anything mid-build
```

Then match, **top row first**:

| What you find | Where the project is | What you run / recommend |
| --- | --- | --- |
| placeholders in `.sdlc/sdlc-config.yml`, or empty `quality_gates` | never configured | **`/fl-bootstrap`**—nothing else works until this is done |
| open PR with unresolved review comments | in review | **`/fl-implement <PR#>`**—the feedback loop (step 8) |
| a worktree in `.worktrees/`, issue at In progress | mid-build | **`/fl-implement <N>`**—resume that issue |
| merged PR whose issue is still open | just merged | **`/fl-pm`**—post-merge reconcile |
| open issues, none in progress | ready to build | **`/fl-implement <N>`**—highest-ranked Ready issue |
| a plan folder with work items whose Next step isn't `None` | plan maturing | **`/fl-pm`**—advance the named item |
| bootstrapped, no plan folder in `wiki/plans/` | nothing open | **`/fl-pm`**—it opens a plan via `/fl-brainstorm` |

More than one row matching is normal on a busy repo. **Say so**, list what's in flight, and
recommend one—the one closest to shipping, since finishing beats starting.

## 2 · End every step with a handoff

Every `fl-*` skill closes by printing three things, and you enforce it even when a skill's own
run was cut short:

1. **What changed**—files, issues, PRs, statuses.
2. **Where that leaves the project**—in the vocabulary of the preceding table.
3. **What happens next**—the step, and the command that runs it directly if the developer wants
   that control.

**Recommend proceeding.** When the next step is unambiguous, say what you'd do and offer to do
it now rather than waiting to be asked. Stop and ask only where a decision is genuinely the
developer's: a scope call, an outward-facing action (issues, PRs, comments), or a blocker.

## 3 · Context

Clear the context when the developer moves to unrelated work, and not as a routine step between
skills—the session's accumulated state is what lets the router know where the project is without
asking. Coder and reviewer run in their own subagents, so the orchestrator only ever holds their
summaries and grows slowly. **Never `/compact`**—it leaves context sediment.

---

## 4 · Source of truth

| File | Holds | Lifecycle |
| --- | --- | --- |
| `AGENTS.md` | the vendor-neutral agent contract | canonical; adapters never contradict it |
| `WORKFLOW.md` | the delivery state machine, all agents | canonical |
| `.agents/roles/` | canonical role definitions | mirrored by `.claude/agents/` + `.codex/agents/` |
| `.sdlc/sdlc-config.yml` | every identifier, path template, and gate command | always current; skills read it, never hardcode |
| `.sdlc/policies/coding-standards.md` | conventions, non-negotiables, open gaps, gotchas | always current |
| `.sdlc/policies/wiki-conventions.md` | the shape of `wiki/` and `specs/` | always current |
| `wiki/CONTEXT.md` | domain language—every fuzzy term pinned | always current; outlives every feature |
| `wiki/prd/` | what we're building and why (master + one per module) | living |
| `wiki/architecture/` | system shape + dated ADRs | living; ADRs superseded, never deleted |
| `wiki/plans/<NN>-<slug>/` | work items maturing toward buildable | retired when complete, kept as record |
| `specs/` | exact contracts, **as-built**—implementers follow blindly | reconciled after every merge |
| GitHub issues + PRs | the build queue and its history | the state store; not a local file |
| code + tests | the real, executable truth | always current |

Where a document and the code disagree, **the code wins** and the divergence is recorded in the
spec's §7 Current State.

## 5 · Operating rules

- **One model for the whole run.** Subagents inherit it.
- **Vertical slices only**—Domain → Infrastructure → Service → API/UI, one narrow behavior,
  at or under `implement.max_changed_loc` including tests.
- **Every slice runs in its own worktree**, with its own fresh subagent carrying only
  `wiki/CONTEXT.md`, the relevant specs and ADRs, `.sdlc/policies/coding-standards.md`, and that
  one issue.
- **Never weaken a test to make it pass.** Affected tests run in-loop; the full gate block runs
  once before each commit.
- **A change to behaviour a spec describes updates that spec in the same PR.** Non-negotiable.
- **Never merge.** The PR is where the loop stops; the developer merges.
- **Risky work is never handed to a subagent unattended**—auth, payments, security, large
  refactors, product judgment. Park it and ask.

## 6 · The roles

Subagents are dispatched as **canonical, vendor-neutral roles** defined in `.agents/roles/`;
`.claude/agents/` are thin adapters onto them, and `.codex/agents/` mirror them for Codex. Keep
the main conversation on product decisions, orchestration and results—**return summaries from
subagents, never raw logs.**

| Role | Owns | Dispatched by |
| --- | --- | --- |
| `spec-analyst` | gap audit before docs are written | `/fl-pm` synthesize, `/fl-implement` step 1 |
| `slice-planner` | reviewed docs → vertical slices | `/fl-pm` issues |
| `slice-implementer` | the only writer for one slice | `/fl-implement` step 4 |
| `reviewer` | read-only review of one slice | `/fl-implement` step 5 |
| `diff-reviewer` | two-axis Standards + Spec review | `/fl-pr-review` |
| `integration-verifier` | acceptance → evidence contract | `/fl-pm` reconcile |

## 7 · The skills

| Skill | Does |
| --- | --- |
| `fl-flow` | always-on router—detects the step from plain language (no slash command) |
| `/fl-bootstrap` | one-time setup: config, gates, CI, labels, board, seeded docs |
| `/fl-pm` | owns the backlog and the docs—plan · synthesize · issues · reconcile |
| `/fl-brainstorm` | relentless one-question interview → resolved work items (writes nothing) |
| `/fl-research` | one question, primary sources, every claim cited (writes nothing) |
| `/fl-prototype` | throwaway code in its own worktree that answers a design question |
| `/fl-design` | build a UI deliberately, bind it to `specs/design-tokens.md`, then render it and look |
| `/fl-diagnose` | finds and proves the mechanism behind a defect (never fixes) |
| `/fl-implement` | issue → worktree → coder → reviewer → PR → PR-feedback loop |
| `/fl-pr-review` | two-axis (Standards + Spec) review published as a real GitHub PR review |

`/fl-pm` is the hub: it holds the plan, and every other skill either feeds it findings or
consumes what it produced. **When in doubt, start there.**

## 8 · The template's own gates

Separate from your project's `quality_gates`, this repository verifies **itself**:

```bash
make check
```

It runs the workflow validator (canonical roles match both vendor adapters, every skill is
invocable, every Markdown link resolves, wiki links stay inside `wiki/`, the config still matches
`schemas/sdlc-config.schema.json`), a secret scan, and the contract tests. CI runs it on every PR.
**If you change the roles, the skills, or the config's shape, run it before you commit.**

Prose has its own gate, because it fails for different reasons:

```bash
make docs        # Google style + signs-of-ai-writing, warnings fail
make docs-sync   # re-download the rule packages
```

It covers `wiki/`, `specs/`, and the root documents. Skill and role files stay outside it: they
are written for machines. The standard, and why two Google rules are turned off, is in
`.sdlc/policies/writing-standards.md`.

New to the flow? **[HOW_WE_BUILD.md](HOW_WE_BUILD.md)** has the ready-to-copy prompts.
