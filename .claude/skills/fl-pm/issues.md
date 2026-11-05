# Slice — specs → GitHub issues

Cut documented work into buildable issues. **Requires the user's explicit go-ahead**: issues
are outward state.

## Parent issue types (fixed vocabulary)

Before creating a new parent, scan open issues for one whose scope already covers the work and
re-use it if it fits.

| Type | When to use | Label |
|---|---|---|
| **Epic** | A work stream with an indeterminate timeline; an ongoing capability area | `epic` |
| **Feature** | Time-bounded development of a new, self-contained capability | `feature` |
| **Task** | A purely operational or maintenance container (runbook, chore batch) | `task` |

**Every plan has exactly one epic, and every issue sliced from a plan is a sub-issue of it —
directly or through a nested feature/task parent.** This is required, not optional: the board is
read epic-first, and a flat issue with no parent is invisible from its plan. The epic is titled
`Epic: Plan NN — <plan title>`, links the plan's `0-plan_map.md`, and is created the first time
the plan is sliced; later slicing runs re-use it. A follow-up or re-slice of an existing issue
becomes a sub-issue of that issue (or of the same epic). Before reporting, confirm no issue you
created is left without a parent.

**Find or create the epic first.** Read the `**Epic:**` line in the plan's `0-plan_map.md`
header. If it names an issue, re-use it (reopen it if it was closed). If it says `none yet`,
create `Epic: Plan NN — <plan title>` with the `epic` label, a Summary linking the plan map and
an empty `## Children` checklist, and write its link back into that `**Epic:**` line in the same
session. Never create a second epic for a plan.

## 1. Read and audit

Read the relevant `specs/` and `wiki/prd/` files, then audit the codebase for what already
exists. An issue that asks for code that is already there is worse than no issue.

## 2. Cut vertical slices

This is the `slice-planner` role (`.agents/roles/slice-planner.md`). Every slice names its
acceptance criteria, dependencies, likely file surface, first failing test, gates, and whether
parallel work on it is safe.

Each issue spans **Domain → Infrastructure → Service → API/UI** for one narrow behavior within
a **single module** (from `.sdlc/sdlc-config.yml`'s `modules:`). A behavior spanning two
modules is two dependent issues, one per module, unless the change in one is trivial.

**LOC check.** Inspect the target files in the touched module's own directory plus its tests.
Estimate `(Added + Modified code lines) + Test lines`. If `Total > implement.max_changed_loc`,
the issue **MUST** be split into dependent issues before proceeding.

### Slicing strategies for oversized features

When a complete slice exceeds `implement.max_changed_loc`, split it into smaller sequential
issues using one of these and link them with `Depends On`:

- **Strategy 1 — Data-first split** (preferred for storage & schema features)
  - **Issue 1 (Data layer)**: schemas/models + storage repository + repository unit tests (~150–200 LOC).
  - **Issue 2 (Service & API layer)**: business logic + route/handler + integration tests (~150–200 LOC, `Depends On: #1`).

- **Strategy 2 — Capability / scenario split** (preferred for complex workflows)
  - **Issue 1 (Core happy path)**: primary read/write flow + standard validation + base tests (~180–220 LOC).
  - **Issue 2 (Advanced logic & reversals)**: rollback, bulk options, edge cases + focused tests (~150–200 LOC, `Depends On: #1`).

- **Strategy 3 — Interface & provider split** (preferred for external API integrations)
  - **Issue 1 (DTOs & client contract)**: data contracts, abstract provider interface, mock fixtures (~120 LOC).
  - **Issue 2 (Provider implementation)**: live provider + integration tests (~180 LOC, `Depends On: #1`).

## 3. Create the issues

`gh issue create --repo <github.slug>` (from `.sdlc/sdlc-config.yml`), on a milestone only if
one already applies to this work — don't invent one. This template is a recommendation; adapt
or omit sections that don't apply:

```markdown
## Summary
## Vertical Slice        (which layers this touches and what gets built in each)
## Implementation Tasks  (checklist)
## Acceptance Criteria   (testable behaviors, not steps)
## Technical Notes       (spec links, contracts, gotchas)
## Estimated LOC
    - Domain & Schemas: ~40 LOC
    - Storage / Infrastructure: ~60 LOC
    - Service Logic: ~80 LOC
    - API / UI: ~40 LOC
    - Unit & Integration Tests: ~70 LOC
    - **Total Estimated LOC**: ~290 / 300 max
## Depends On            (#issue refs, or "none")
```

## 4. Label

`gh label list` for what's already in use. Apply a **component label naming the module** the
issue touches, creating it only if none fits. Parent issues get their type label (`epic`,
`feature`, `task`).

## 5. Link children to their parent

Every child issue gets a **native GitHub sub-issue link** to its plan epic (or nested parent) —
this is what makes a merged PR tick the parent's boxes:
```bash
child_id=$(gh api repos/<owner>/<repo>/issues/<child_number> --jq '.id')
gh api repos/<owner>/<repo>/issues/<parent_number>/sub_issues -X POST -F sub_issue_id=$child_id
```
Note `-F` (not `-f`) — `sub_issue_id` must go as an integer, and it's the issue's internal
`id`, not its `number`. Update the parent's own checklist body to reference the new issues as
well; the sub-issue link and the checklist line are both expected, neither substitutes for the
other. Verify with:
```bash
gh api repos/<owner>/<repo>/issues/<parent_number>/sub_issues --jq '.[].number'
```

## 6. Set each new issue's board status

**Skip this step entirely when `github.project.enabled` is false** — an issue's readiness is
then read from its `Depends On` line alone.

New issues auto-add to the project at **Backlog**, so this stays a manual step. Use the board
move from `SKILL.md`:
- `Depends On: none` **and** not a parent → **Ready**.
- Any unresolved `Depends On`, or a parent (epic/feature/task) → leave at **Backlog**. Parents
  aren't directly buildable, so they never reach Ready whatever their own `Depends On` says.

## 7. Report

The plan's epic (created or re-used), every created issue number with a one-line summary, the
sub-issue link confirmed for each, and each status confirmed set.

**Handoff:** "Issues #N–#M filed, #N and #P are unblocked. Next: implementing #N
(`/fl-implement <N>` to run it directly)."
