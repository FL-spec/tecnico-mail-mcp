# 2026-09-07—Single entry point and two delivery lanes

- **Status:** Accepted
- **Date:** 2026-09-07

## Context

Delivering one small change costs six skill invocations, three hand-typed `/clear` commands, two
blocking stops for the developer, and six subagent spawns. That's the happy path, with no
research, no prototype, and no review round. `.claude/skills/fl-implement/SKILL.md` runs the
feasibility gate on every issue, "including the ones that look small," so a one-line fix pays the
same toll as a new module.

About half the work in a typical week is a change the developer can state in one sentence against
a module that already exists. The rest is genuinely new and earns the full pipeline. The workflow
offers one speed for both, and that speed is the speed of designing a subsystem.

Plain language is meant to route through `fl-flow` so the developer never types a command. Three
mechanisms compete to do that routing: the detection table in `CLAUDE.md`, the routing table
inside `fl-flow`, and the descriptions of the nine other `fl-*` skills, which the model matches
directly. `fl-flow` is one candidate among ten for the same sentence, and ambiguous routing falls
back to the developer naming the command by hand.

The delivery rules are stated many times over. "Never weaken a test" appears in ten files, the
same-pull-request spec rule in sixteen, "vertical slice" in thirteen. The five root documents
carry 941 lines of contract prose between them before any skill file opens, and
`scripts/validate_workflow.py` with `tests/test_workflow_contract.py` add 677 lines whose main job
is keeping those copies from drifting apart.

`wiki/plans/` is the only state store nothing enforces. GitHub owns issue state and the reviewer
checks `specs/`, while the plan map's **Status** and **Next step** columns are maintained by hand
alongside both.

## Decision

**One router.** `fl-flow` keeps the only skill description the model matches against plain
language. The other skills stay invocable by name for direct control, and stop competing for the
same sentence. The detection table moves out of `CLAUDE.md` and into `fl-flow`, which is the only
place it now lives.

**Two lanes, and the agent picks.** A fast lane files an issue and runs the implementation loop
straight through. The design lane keeps today's pipeline: interview, documents, plan folder,
issues. The fast lane requires all of: the target module exists, its spec covers the behavior, the
change fits `implement.max_changed_loc`, and no new domain term appears. Any doubt takes the
design lane. The agent states the call in one line, proceeds without waiting, and honors a
one-word override in either direction.

**`specs/` never skips.** Both lanes update the module spec's external surface, invariants, and
current state in the same pull request, exactly as `.sdlc/policies/coding-standards.md` already
requires. The fast lane skips the plan folder and the product requirements document, because a
change with no deliberation behind it has no deliberation to record.

**Four roles instead of six.** `reviewer` takes a scope of slice, diff, or completion, absorbing
`diff-reviewer` and `integration-verifier`. It gains an explicit test-integrity checklist: did the
failing test fail for the stated reason, was any test weakened, skipped or deleted, and does every
acceptance criterion map to a named test. The remaining roles are `spec-analyst`, `slice-planner`,
and `slice-implementer`.

**One approval before code, instead of two stops.** The design lane writes the documents and files
the issues in one pass, then presents both together for approval. The developer reviews the
documents beside the slices they produced, which is where a documentation problem becomes visible.
The developer still merges every pull request.

**Rules stated once.** `AGENTS.md` becomes the only place a delivery rule is written. `WORKFLOW.md`
keeps the state machine and links the rules. `CLAUDE.md` shrinks to the Claude-specific adapter.
`HOW_WE_BUILD.md` merges into `README.md`. Role files under `.agents/roles/` describe only what is
specific to the role. A script generates `.codex/agents/` from `.agents/roles/`, so the validator
stops checking for drift that can no longer happen.

**Derived plan status.** Wherever a work item has an issue, `fl-pm` regenerates its **Status** and
**Next step** from GitHub rather than editing them by hand. Deliberation stays hand-written.

**A project board on every new repository.** `/fl-bootstrap` provisions the board by default and
`github.project.enabled` ships as `true`, because a team reads readiness off a board rather than
off a `Depends On` line.

The mandatory `/clear` between skills goes. It's a command the developer types to discard
the context that would let the agent route without asking.

## Consequences

A small change costs one sentence from the developer and one merge click. The design lane keeps
its interview and its documents, and costs one approval instead of two stops.

`specs/`, the glossary, issues and pull requests stay complete for every change in both lanes.
Plan folders and product requirement documents now cover the design half only, so the record of
*how a decision got made* exists for the work that involved a decision.

Contract prose drops from roughly 941 lines to roughly 450, and the validator gets smaller as
generation replaces mirror checking.

Triage becomes a thing that can be wrong. A change misrouted to the design lane wastes ceremony. A
change misrouted to the fast lane reaches a pull request without the design work it needed, which
is the expensive direction, so the rule leans toward the design lane and the developer can
override downward.

`fl-flow` becomes load-bearing. A failure there is a failure to route anything, where today a
missed route degrades into the developer naming a command.

Moving the approval gate means issues reach the board before the developer has read the documents.
Teammates can see an issue that review later changes or closes.

## Alternatives considered

- **A separate tester agent, as originally proposed**—an agent writing tests after the implementer
  writes tests that describe the implementation rather than the requirement, and it breaks the
  failing-test-first ordering the workflow depends on. The read-only half of that idea is real, so
  it lands in `reviewer` as the test-integrity checklist.
- **Collapsing every skill into one agent**—the interview, the slicing, and the implementation loop
  want different instructions and different tool access. One agent holding all of it loses the
  read-only boundaries that keep an implementer from approving its own work.
- **Keeping both stops**—the stop between documents and issues is the longest pause in the
  pipeline, and reviewing documents without the slices they produce hides the problems that
  slicing exposes.
- **Deleting the plan layer**—it earns its cost on the design half, and a team needs the record of
  how a decision got reached. Scoping it to that half keeps the value and drops the ceremony.
- **Leaving routing as it is and only cutting documents**—the duplication is a maintenance cost,
  while the command count is the daily one. Cutting prose alone leaves the developer typing the
  same six commands.
