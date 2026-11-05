# Plan — maintain a plan

A plan is a set of work items that share one goal, start diffuse, and **mature** — each one
advancing by a single **next step** at a time until it's ready to build. You own every file
under `wiki/plans/`; nothing else writes there.

You don't do the work of a next step yourself. You choose it, dispatch it, record what comes
back, and re-read the plan in light of it. `write-document` and `create-issues` are the
exception — those next steps are your own workflows (`synthesize.md`, `issues.md`), not a
dispatch elsewhere.

## The plan folder

One folder per plan: `wiki/plans/<NN>-<slug>/`, where `<NN>` is the next immutable
repository-wide two-digit sequence number — scan existing folders for the highest before
assigning.

**`0-plan_map.md`** — the permanently readable index. A header block with the plan's **Epic**
(the GitHub parent issue every issue sliced from this plan sits under — `none yet` until the
first slice creates it), plan **Status** (`active`, `parked`, `complete`), **Date**, and a
one-paragraph **Summary** of the goal. Then a table:

| Work item | Next step | Description | Status |

Below the table, one section per work item holding only its finding or open question, why it's
independent, and its named dependencies. Keep the map lean — it's the thing you re-read every
session.

Templates for all three files live in `wiki/plans/_template/`. Copy them rather than improvising
a layout.

**`acceptance.md`** and **`verification.md`** — created once a plan reaches `create-issues`. The
criterion-to-evidence trail the `integration-verifier` role fills in before promotion. A plan that
ships without them has no record that its acceptance criteria were ever actually met.

**`<N>-<slug>.md`** — a work item's detail file, created the first time that item receives
substantive work. This is where everything a next step returns accumulates: research findings
with their sources, a diagnosis and its evidence, a prototype's verdict, a brainstorm's
resolved decisions, the docs a `write-document` pass produced, the issues a `create-issues`
pass filed. Append with a **dated heading per entry** so the item's maturing reads as a
history. Once a detail file exists, the map gains only its link and changes to Next step or
Status.

## Next steps

A work item's **Next step** is one concrete action, never a static classification. The
vocabulary:

| Next step | Dispatch to | For |
|---|---|---|
| brainstorm | `/fl-brainstorm` | the item is still diffuse — its shape, scope, or goal isn't settled |
| research | `/fl-research` | an external fact decides it — docs, an API's real behavior, a library's semantics |
| prototype | `/fl-prototype` | it can't be settled on paper — a state model, a data shape, a layout |
| diagnose | `/fl-diagnose` | something in the code or stored data is wrong and the cause isn't known |
| decide | you and the user | two named options, both understood, nothing left to learn |
| write-document | `synthesize.md`, in this skill | resolved enough to become durable docs — a PRD, a spec, an FDR/ADR |
| create-issues | `issues.md`, in this skill | the written docs are reviewed and confirmed; ready to cut into buildable issues |
| implement | `/fl-implement <N>` | already sliced into an issue |
| None | — | done; the completion history lives in its Status |

Dispatch one item's next step at a time, and pick it by **what the item actually lacks**. A
brainstorm that should have been research burns a session on opinion where a fact was
available; a prototype that should have been a decision builds something to confirm what's
already known; a `write-document` pass on findings that are still shifting produces docs
you'll rewrite next session.

`write-document` and `create-issues` stay two separate steps, never one: `synthesize.md` ends
at a stop, because issues are outward state the user must read the docs before agreeing to. A
work item's Next step only becomes `create-issues` once the user has actually read the written
docs and said go — don't set it as a default follow-on to `write-document`.

## Session loop

### 1. Read the plan
Open `0-plan_map.md` and every detail file whose item is still moving. If no plan exists yet
and the user is opening one, run `/fl-brainstorm` first — a plan is written from resolved work
items, not from an empty folder.

### 2. Advance one work item
Propose which item to advance and its next step, **with the reason**. On the user's go-ahead:
- **brainstorm / research / prototype / diagnose** — dispatch to that skill and wait for what
  it returns.
- **write-document / create-issues** — follow the named workflow file yourself; there's
  nothing to dispatch or wait for.

### 3. Record what came back
Append it to the item's detail file under a dated heading — **the findings themselves, not a
summary of them**, with whatever sources or evidence came with them. For `write-document`,
record which `wiki/` and `specs/` files you wrote. For `create-issues`, record the issue
numbers and their one-line summaries. Then update the map: the item's **Next step** becomes
whatever the result now makes it, and its **Status** gains a line of history.

### 4. Re-read the plan in light of it
Work items in one plan share a goal, so they move each other. Before closing the loop, walk
**every other item** and ask what this result changed: a fact that settles someone else's open
question, a diagnosis that makes another item unnecessary, a decision that creates a new
dependency, a prototype verdict that reshapes a sibling's scope, a doc that already answers a
sibling's question. Update every item the result touched — each one either revised or
explicitly confirmed untouched. This is the step that keeps a plan coherent rather than a list
of parallel monologues; skipping it lets the map drift out of step with its own detail files.

### 5. Report
What advanced, what it changed elsewhere, and what you'd advance next — then the handoff block
from `SKILL.md`.

## Status and retirement

Plans are **active** from creation. **Parked** when no item is currently being advanced.
**Complete** only when every work item's Next step is `None`.

A completed work item keeps its history in Status — issue numbers, PRs, merges, outcomes. When
the last one lands, set the plan's Status to `complete` and say so: the plan is **retired**,
and its detail files stay as the record of how each decision was reached.

## Rules
- Every file under `wiki/plans/` is written by you and only you. The activity skills return
  findings; you record them.
- Opening or retiring a plan needs its `wiki/_Sidebar.md` entry added or its status changed —
  you own that file, so do it in the same pass rather than deferring to yourself later.
- A work item earns a detail file when it receives substantive work, not before.
- One next step at a time per item. **An item with two next steps is two work items.**
