# How We Build

```
/fl-bootstrap → /fl-pm ⇄ (brainstorm · research · prototype · diagnose) → /fl-pm → /fl-implement → /fl-pm
```

You drive the thinking. Agents drive the building. You don't type the commands.

**You don't have to type any of these.** Describe what you want in plain language and the
always-on router works out which step you're on and continues from there—the commands below are
for when you want direct control. The same lifecycle runs under Codex: `AGENTS.md` and
`WORKFLOW.md` are the canonical contract, and `.agents/roles/` holds the roles both vendors use.

The one idea underneath all of it: **a work item advances by one concrete next step at a time,
and never skips a step it hasn't earned.** A thing that needs a fact gets research, not an
opinion. A thing that needs a decision gets you, not a prototype. Documentation only gets
written once the findings have stopped moving, and issues only get cut once you've read the
documentation.

---

## 0 · `/fl-bootstrap`—once per project

```
/fl-bootstrap
```

Interviews you on stack and modules, writes the config and the coding standards, wires the
quality gates and CI, creates the labels, provisions the board, and seeds `wiki/` + `specs/`.
Nothing else runs until this is done.

**About the board.** A new GitHub project has three statuses; this flow needs five (Backlog,
Ready, In progress, In review, Done). Bootstrap writes the missing ones for you through the
GraphQL `updateProjectV2Field` mutation, so there is nothing to click.

The mutation replaces a single-select field's whole option set instead of appending to it, which
is the trap everyone hits: resend the existing options without their ids and each is recreated
with a new id, detaching every issue parked in it. Bootstrap therefore reads the options first and
resends them **with their ids**, and it counts the board's items before writing. On a fresh board
(zero items) it proceeds. On a board with items, where the change is more than a pure addition, it
stops and shows you the difference instead of reshuffling statuses that issues are living in.

Don't want a board at all? Say so, and it sets `project.enabled: false`. The flow reads readiness
from each issue's `Depends On` line instead, and every board move is skipped.

→ a configured repo. Next: `/fl-pm`.

---

## 1 · `/fl-pm`—open a plan

```
/fl-pm

I want to build [thing] for [who] so they can [outcome].
```

`/fl-pm` owns the backlog and the docs. With nothing open, it runs `/fl-brainstorm` for you.

→ `wiki/plans/<NN>-<slug>/0-plan_map.md`. Next: advance an item.

---

## 2 · The maturity skills—advance one work item

`/fl-pm` picks the next step and dispatches. You rarely call these directly.

| Next step | Skill | For |
| --- | --- | --- |
| brainstorm | `/fl-brainstorm` | the item is still diffuse |
| research | `/fl-research` | an external fact decides it |
| prototype | `/fl-prototype` | it can't be settled on paper |
| diagnose | `/fl-diagnose` | something is wrong and the cause is unknown |
| decide | you | two named options, nothing left to learn |

**In a brainstorm you answer Yes / No / Almost:**

| You say | Means |
| --- | --- |
| **Yes** | locked, move on |
| **No** | wrong—discard and adjust |
| **Almost** | close—refine until it's a Yes |

→ findings. Take them back: `/fl-pm`, "here's what came back from the research."

---

## 3 · `/fl-pm`—write it down, then cut it up

Two separate steps, deliberately:

```
/fl-pm

Synthesize this plan.
```
→ PRDs, specs, ADRs/FDRs in `wiki/` and `specs/`. **Then it stops.** You read them.

```
Looks right. Cut the issues.
```
→ vertical-slice GitHub issues, sized under 300 LOC, dependency-linked, labelled, on the board.

---

## 4 · `/fl-implement <N>`—build it

```
/fl-implement 14
```

Feasibility gate → worktree → coder subagent (tests first) → reviewer subagent (max 3 rounds) →
issue checklist ticked → **PR opened, never merged**.

Several at once, one branch, one PR:
```
/fl-implement 14 to 18
```

When the PR draws review comments:
```
/fl-implement 231        # the PR number — runs the feedback loop
```
Every thread ends fixed-and-replied or declined-and-replied, and resolved.

Want a deeper review of your own first?
```
/fl-pr-review main
```
→ a real GitHub review, inline comments and suggestions, `COMMENT` or `REQUEST_CHANGES`.

---

## 5 · `/fl-pm`—after you merge

```
/fl-pm

Post-merge for #14.
```
→ `specs/` §7 Current State reconciled, issue closed, worktree removed, board moved, dependents
unblocked, and the ready queue reported back.

---

## 6 · `/fl-design`—make it look deliberate

```
/fl-design

Build the settings screen from prd/web.md.
```

Reads `specs/design-tokens.md` as a contract, chooses typography, color, depth, and motion on
purpose rather than by default, writes the decisions back into the token spec, then **renders the
result and looks at it**: 375px and desktop, both themes, real data, contrast, keyboard, reduced
motion. Screenshots are the evidence.

Exploring several directions first is `/fl-prototype`'s `UI.md` branch. Come here once you know
which direction you want.

---

## Cheat sheet

| Want to… | Run |
| --- | --- |
| Set up a new repo | `/fl-bootstrap` |
| Build or restyle a UI | `/fl-design` |
| Open a plan / know what's next | `/fl-pm` |
| Shape a fuzzy idea | `/fl-brainstorm` |
| Settle an external fact | `/fl-research` |
| Try a design out | `/fl-prototype` |
| Find out why something's broken | `/fl-diagnose` |
| Write the docs / cut the issues | `/fl-pm` |
| Build an issue | `/fl-implement <N>` |
| Review a branch | `/fl-pr-review <base>` |
| Handle PR comments | `/fl-implement <PR#>` |
| Reconcile after a merge | `/fl-pm` |

**Rules:** never `/compact` · vertical slices only · tests never weakened · specs updated in
the same PR · never auto-merge.

---

## Writing documentation

Prose is gated, not merely encouraged. `.sdlc/policies/writing-standards.md` holds the standard:
lead with the claim, prefer the concrete, give the reason when a rule is surprising, and structure
each document as exactly one of Diátaxis's four kinds. Diagrams are Mermaid, which renders in
GitHub, the wiki, and artifacts with no build step.

```bash
make docs             # the gate: Google style + signs-of-ai-writing, warnings fail
make docs-suggestions # advisory: everything the gate let through
make docs-sync        # re-download the rule packages
```

The `signs-of-ai-writing` rules come from Wikipedia's *Signs of AI Writing* and catch hedging
clusters, enumeration tics, contrastive "not just X, it's Y" phrasing and chatbot paste artifacts.
They apply to your writing and the agent's equally.

---

## Checking the template itself

```bash
make check
```

Validates that the canonical roles match their Claude and Codex adapters, every skill is
invocable, every Markdown link resolves, wiki links survive the mirror, and
`.sdlc/sdlc-config.yml` still matches its schema—then scans for secrets and runs the contract
tests. CI runs it on every PR. Run it yourself after changing roles, skills, or the config shape.

> Lost? Claude reads `CLAUDE.md` every session, works out where the project is, and tells you.
