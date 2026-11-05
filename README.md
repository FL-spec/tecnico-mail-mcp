<div align="center">

# Setup

A GitHub template that starts every project with a spec-driven, test-driven delivery workflow run by AI agents.

[![CI](https://github.com/FL-spec/Setup/actions/workflows/ci.yml/badge.svg)](https://github.com/FL-spec/Setup/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/FL-spec/Setup)](https://github.com/FL-spec/Setup/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

`v2.1.1`

[How we build](HOW_WE_BUILD.md) · [Workflow](WORKFLOW.md) · [Agent contract](AGENTS.md) · [Phone setup](SETUP.md) · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md)

</div>

Create a repository from this template and every project starts on the same rails. A diffuse
idea moves through design, documentation and buildable issues to a reviewed pull request. Agents
do the building; you keep every decision that matters. It runs under Claude Code and Codex.

## How we develop

Work **matures**. It doesn't get pushed through a pipeline.

```mermaid
flowchart TD
    B["/fl-bootstrap<br/>once per repo"] --> PM["/fl-pm<br/>plan"]
    PM <--> L["/fl-brainstorm · /fl-research<br/>/fl-prototype · /fl-diagnose"]
    PM --> D["docs in wiki/ and specs/"]
    D --> I["GitHub issues"]
    I --> IMP["/fl-implement N<br/>worktree, coder, reviewer"]
    IMP --> PR["reviewed pull request"]
    PR --> R["/fl-pm post-merge<br/>specs reconciled"]
    R --> PM
```

A plan is a set of **work items sharing one goal**, each carrying exactly one **next step** from
a fixed vocabulary—brainstorm, research, prototype, diagnose, decide, write-document,
create-issues, implement. `/fl-pm` picks the next step by asking what the item actually *lacks*,
dispatches it, records what comes back, and then re-reads **every other item** in light of it.
That last part is what keeps a plan coherent instead of a set of parallel monologues.

| Phase | Command | Human-in-the-loop? | Output |
| --- | --- | --- | --- |
| **0. Configure** | `/fl-bootstrap` | Yes | a wired repo: config, gates, CI, labels, board, seeded docs |
| **1. Shape** | `/fl-pm` → `/fl-brainstorm` | Yes | a plan of resolved work items |
| **2. Learn** | `/fl-research` · `/fl-prototype` · `/fl-diagnose` | Partly | cited facts, verdicts, proven mechanisms |
| **3. Document** | `/fl-pm` synthesize | Review gate | PRDs, specs, ADRs/FDRs—**then it stops** |
| **4. Slice** | `/fl-pm` issues | Your go-ahead | vertical-slice issues, ≤300 LOC, dependency-linked |
| **5. Build** | `/fl-implement <N>` | Only for risky slices | a reviewed PR that closes the issue |
| **6. Reconcile** | `/fl-pm` post-merge | No | specs updated, dependents unblocked |

### Why it's built this way

- **Think with a human, build with agents.** Judgment lives in phases 1–4. Once an issue exists,
  `/fl-implement` runs a coder subagent and a read-only reviewer subagent (up to three rounds)
  and stops at a PR. **It never merges.**
- **Spec before code, as-built after.** `specs/` holds exact contracts implementers follow
  blindly. Where the code and a spec disagree, **the code wins** and the divergence is recorded.
  A PR that changes behaviour a spec describes updates that spec *in the same PR*—a spec that
  lags a merge is worse than no spec, because the next implementer trusts it.
- **Two separate gates before outward state.** Documentation gets written, then **you read it**,
  then issues get cut. Issues created from unreviewed docs are state you never agreed to.
- **Vertical tracer-bullet slices.** Domain → Infrastructure → Service → API/UI for one narrow
  behavior, capped at 300 changed lines including tests, with named strategies for splitting
  anything bigger.
- **Context isolation.** Every slice runs in its own worktree, in a fresh subagent carrying only
  the glossary, the relevant specs and ADRs, the coding standards, and that one issue. The
  orchestrator keeps only the returned summaries—no context rot.
- **Test-driven, always.** RED → GREEN → REFACTOR through the public interface. Tests are never
  weakened to pass; the gates run once before every commit.
- **Decisions are durable and dated.** Business calls become FDRs. Technology and structure
  calls become ADRs. Superseded, never deleted.
- **GitHub is the state store.** Issues, sub-issues, PRs and review threads—not a local
  progress file that goes stale the moment two sessions run at once.
- **Cross-agent by construction.** `AGENTS.md` and `WORKFLOW.md` are the canonical contract, and
  the six roles in `.agents/roles/` are vendor-neutral. `.claude/agents/` and `.codex/agents/` are
  thin adapters, so Claude and Codex run the same lifecycle—and `make check` fails if they ever
  drift apart.
- **Commands are optional.** The always-on `fl-flow` router detects the step from plain language;
  the `/fl-*` commands are there when you want direct control, not as a prerequisite.
- **The template verifies itself.** `make check` validates that the roles match their adapters,
  every skill is invocable, every Markdown link resolves, wiki links survive the mirror, and the
  config still matches its JSON Schema. CI runs it on every PR.
- **Prose is a gate, not a preference.** `make docs` runs [Vale](https://vale.sh/) over the
  documentation with Google's developer style guide and the `signs-of-ai-writing` rule set, built
  from Wikipedia's *Signs of AI Writing*. Warnings fail. It catches hedging clusters, enumeration
  tics, contrastive "not just X, it's Y" phrasing, and chatbot paste artifacts, which makes
  "reads like a person wrote it" checkable rather than a matter of taste. It lints the agent's
  output and yours identically.
- **Design is a contract.** `/fl-design` carries a deliberate-by-default design standard and binds
  it to `specs/design-tokens.md`, so the palette and type scale outlive the session that chose
  them. A UI slice is not done until someone rendered it and looked at it, at 375px, in both
  themes, with real data.

> Full walkthrough with copy-paste prompts: **[HOW_WE_BUILD.md](HOW_WE_BUILD.md)**

## Set up a project

### Prerequisites

| You need | Because |
| --- | --- |
| `gh`, authenticated | issues and pull requests are the state store |
| Python 3.11+ | the template's own gates (`make check`). `make install-dev` adds the two libraries that turn on deep config validation |
| [Vale](https://vale.sh/) | the prose gate (`make docs`). It downloads its rule packages on first run, `make docs-sync` refreshes them, and CI installs it for you |
| `read:project` and `write:project` | only for the project board: `gh auth refresh -s read:project,write:project`. Without a board, set `github.project.enabled: false` and the flow runs on issue state alone |

### 1 · Create the repository

```bash
gh repo create my-project --private --template FL-spec/Setup --clone
cd my-project
claude
```

### 2 · Bootstrap it once

```
/fl-bootstrap
```

One interview covers the stack, the modules, and the conventions, and what comes out of it is a
repository wired end to end:

| Bootstrap produces | Where it lands |
| --- | --- |
| identifiers, path templates, and gate commands | `.sdlc/sdlc-config.yml`, validated against `schemas/sdlc-config.schema.json` |
| language conventions and non-negotiables | `.sdlc/policies/coding-standards.md` |
| the quality gates, **verified by running them** | the config, then `.github/workflows/ci.yml` |
| issue labels and a five-status project board | GitHub |
| documentation seeded with your real module names | `wiki/`, `specs/` |

Every skill reads that config rather than hardcoding a path or a command, so the flow follows your
project's conventions instead of the template's defaults. Nothing else runs until bootstrap
finishes.

**The board arrives provisioned, with nothing to click.** A new GitHub project ships three
statuses and this flow needs five—Backlog, Ready, In progress, In review, Done—so bootstrap
derives the project, field, and option ids and writes the missing statuses through GraphQL. That
mutation replaces a single-select field's whole option set instead of appending to it, so bootstrap
resends the existing options with their ids and stops rather than reshuffling a board that already
holds items. [HOW_WE_BUILD.md](HOW_WE_BUILD.md) has the detail.

### 3 · Open the first plan

```
/fl-pm
```

With nothing open, `/fl-pm` runs a brainstorm and writes the result to
`wiki/plans/<NN>-<slug>/`. From there the preceding phases carry the work to a reviewed pull
request.

### Every session after that

Claude reads `CLAUDE.md`, works out where the project actually is—from the config, the plan
folders, open issues, open pull requests, and live worktrees—tells you, runs that step, and closes
by telling you what changed and what comes next. Describing what you want in plain language does
the same thing: the always-on `fl-flow` router detects the step and continues from there.

## Work from your phone

This repo ships with a [dev container](.devcontainer/devcontainer.json) that pre-installs Claude
Code and Codex in every GitHub Codespace, alongside `gh` and the Node, Python, and Rust
toolchains. You can drive the whole flow from a phone browser, with no PC left running. See
**[SETUP.md](SETUP.md)**.

## What's in here

```
AGENTS.md            Canonical, vendor-neutral agent contract — every agent reads this
WORKFLOW.md          Canonical delivery state machine (mermaid), all agents
CLAUDE.md            Claude adapter: session navigator, detection table, role dispatch
HOW_WE_BUILD.md      The method, with ready-to-copy prompts
README.md            This file
CHANGELOG.md         Release history
CONTRIBUTING.md      How to change the template
SECURITY.md          How to report a vulnerability
SETUP.md             Phone / Codespaces workflow
Makefile             make check — the template's own gates
.agents/roles/       Canonical role definitions (vendor-neutral)
.codex/              Codex adapters onto those roles
schemas/             JSON Schema for .sdlc/sdlc-config.yml
scripts/             validate_workflow.py · scan_secrets.py
tests/               The template's contract tests
.sdlc/
  sdlc-config.yml    Every identifier, path template and gate command — skills read this
  policies/          coding-standards.md · wiki-conventions.md · writing-standards.md
.claude/
  skills/            fl-flow (always-on router) · fl-bootstrap · fl-pm · fl-brainstorm
                     fl-research · fl-prototype · fl-design · fl-diagnose · fl-implement
                     fl-pr-review
  agents/            Claude adapters onto .agents/roles/
  hooks/             git-guardrails.sh — blocks force-push, hard reset, .env commits
  settings.json      PreToolUse hook wiring
.github/
  workflows/         ci.yml (template contract + stack presets) · security.yml · sync-wiki.yml
  scripts/           flatten_wiki.py — publishes wiki/ to the GitHub Wiki
  CODE_OF_CONDUCT.md  Contributor Covenant 2.1
  ISSUE_TEMPLATE/     Bug report and workflow-change forms
  pull_request_template.md
wiki/
  CONTEXT.md         Domain glossary — loaded into every subagent
  prd/               Master + child PRDs, dated FDRs
  architecture/      System shape, dated ADRs
  plans/             Plan folders: work items, acceptance and verification records
  reports/           Point-in-time reviews
specs/               Exact contracts, as-built — 00-contracts.md + one per module
.devcontainer/       Codespaces config with Claude Code and Codex preinstalled
.vale.ini            Prose gate: Google style + signs-of-ai-writing
.vale/styles/        Downloaded rule packages (gitignored)
```

## Verify the template itself

Separate from your project's quality gates, this repository checks itself:

```bash
make check
```

The workflow validator confirms that the canonical roles match both vendor adapters, every skill is
invocable, every Markdown link resolves, wiki links stay inside `wiki/`, and the config still
matches its JSON Schema. It then scans for secrets and runs the contract tests. CI runs the same
gate on every pull request, and you should run it after changing the roles, the skills, or the
shape of the config.

Prose has its own gate, because it fails for different reasons:

```bash
make docs             # Google style + signs-of-ai-writing, warnings fail
make docs-suggestions # advisory: everything the gate let through
```

## Limitations

- The flow assumes GitHub. Issues, pull requests and the optional project board are its state
  store, so GitLab or Bitbucket need the skills rewritten.
- `/fl-bootstrap` has to run before anything else. Until it does, `make check` reports the
  config placeholders that remain and the `fl-*` skills stop early.
- The 300-line slice cap is a default in `.sdlc/sdlc-config.yml`. Large refactors need splitting
  by hand or a raised cap.
- Risky work (auth, payments, security, large refactors) is never handed to a subagent
  unattended. Expect the agent to stop and ask.
- Template updates don't flow into projects already created from it. Pull changes in by hand,
  using the [changelog](CHANGELOG.md) as the guide.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report vulnerabilities privately as described in
[SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). The interview method descends from Matt Pocock's `grill-with-docs`.

---

<div align="center">
<sub>v2.1.1. Release history is in the <a href="CHANGELOG.md">changelog</a>.</sub>
</div>
