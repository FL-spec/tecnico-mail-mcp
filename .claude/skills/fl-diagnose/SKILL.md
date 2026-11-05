---
name: fl-diagnose
description: >
  Find the cause of a defect or anomaly in the codebase or the stored data, and prove the
  mechanism without fixing it. Invoked by fl-flow, or when the user types /fl-diagnose.
routed-by: fl-flow
---

# Diagnose

Find the **mechanism** — the specific code path or data condition that produces the wrong
result — and **prove it**. A diagnosis that names a suspect without demonstrating it is a
hypothesis wearing a verdict's clothes.

You investigate; **you don't fix**. What you return goes to `/fl-pm`, which records it in the
work item's detail file. A confirmed defect ready to be built becomes a work item whose next
step is `write-document`.

## Scope

**Yours**: the code, the tests, and the data at rest. Local, reproducible, **read-only**
investigation.

Data is read-only throughout. Reading the store is diagnosis; writing to it is a fix, and
fixes go through `/fl-implement`.

## Method

### 1. State the symptom precisely
What is observed, where, and what was expected instead — **with the actual values**. "The
totals look wrong" is not a symptom; "order `A-1042` reads `total = 0` in `orders.summary`
where the line items sum to 148.50" is.

### 2. Reproduce it
Reproduce the symptom locally **before theorising**: a failing test, a query against the
store, a direct call to the service. A symptom you can't reproduce is the first finding —
report what you tried and what the store actually shows.

The reproduction is what makes the rest binary. With it, every hypothesis becomes checkable;
without it, the investigation runs on plausibility.

### 3. Narrow
Bisect the path between correct input and wrong output. Check the value at each boundary and
find the **first one where it's already wrong**. Where the defect appeared in time,
`git log` / `git bisect` on the touching files narrows the same way.

Follow the evidence rather than the most likely story. The suspicious-looking function is a
hypothesis like any other, and gets checked, not assumed.

### 4. Confirm the mechanism
Name the exact line or data condition, and **demonstrate it**: change that one thing and watch
the symptom move. A cause that can't be made to appear and disappear on demand is still a
suspect.

### 5. Report
- **Symptom** — observed vs. expected, with real values.
- **Reproduction** — the exact command, test, or query, so anyone can re-run it.
- **Mechanism** — the file, line, or data condition, and the demonstration that it's causal.
- **Blast radius** — what else this touches. Check it; don't assume the report's example is
  the only case.
- **Fix sketch** — what a fix would change and what regression test would pin it. Enough for
  `/fl-pm` to slice an issue, **not the fix itself**.
- **What stayed unexplained** — anything the evidence didn't cover.

**Handoff:** "Mechanism confirmed at `<file:line>`. Next: `/fl-pm` to record it and slice the
fix into an issue."
