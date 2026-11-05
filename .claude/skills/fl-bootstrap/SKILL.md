---
name: fl-bootstrap
description: >
  First-run setup for a repo cloned from this template: interview the developer on stack and
  modules, fill in .sdlc/sdlc-config.yml and coding-standards, wire the quality gates and CI,
  create the labels and the project board, and seed wiki/ + specs/ with real module names. Runs
  once per project. Invoked by fl-flow, or when the user types /fl-bootstrap.
routed-by: fl-flow
---

# Bootstrap

Turn a fresh clone of this template into a configured repo. **Run once.** Every other `fl-*`
skill stops and sends the user here while `<ANGLE BRACKET>` placeholders remain in
`.sdlc/sdlc-config.yml`.

You do write files — this is the one skill that does. Nothing here is outward-facing until step
5, which asks first.

## 0. Check you're needed

```bash
grep -n '<[A-Z_]*>' .sdlc/sdlc-config.yml
gh auth status
git remote -v
```
No placeholders left and a non-empty `quality_gates` → the repo is already bootstrapped. Say so
and offer to re-run a single section instead of the whole thing.

## 1. Interview

One question at a time, **recommendation first**, same rules as `/fl-brainstorm`. Read what's
already in the repo before each question — a `package.json`, `pyproject.toml`, or `Cargo.toml`
answers most of them, and asking what's on disk wastes the user's attention.

Establish, in this order:

1. **What the project is** — one paragraph. Feeds `README.md` and `wiki/prd/00-master-prd.md`.
2. **Modules** — the top-level directories a vertical slice can live in, with the stack of each.
   A single-module repo is normal and fine; say so rather than inventing a split. Each module
   gets a child PRD and a spec, so the list is a real commitment.
3. **Stack per module** — which of the three presets in `sdlc-config.yml` fits (Node/pnpm,
   Python/uv, Rust/cargo), or a custom command set.
4. **The real gate commands** — verify each one **by running it**, not by assuming the preset is
   right. A gate that doesn't run is worse than no gate, because the reviewer subagent reports it
   green. A command that can't work yet (no test runner, no integration environment) becomes a
   `TODO` in the config **and** a line under "Open gaps" in `.sdlc/policies/coding-standards.md`.
5. **Project board** — do they want one? If not, `project.enabled: false` and skip step 5's board
   half entirely; the flow works without it.
6. **Domain terms** — anything already fuzzy. Straight into `wiki/CONTEXT.md`.

## 2. Write `.sdlc/sdlc-config.yml`

- `github.{owner,repository,slug}` from `git remote -v`, and `default_branch` from
  `git symbolic-ref refs/remotes/origin/HEAD` (fall back to asking).
- `modules:` — one entry per module, with `name`, `path`, `stack`.
- `quality_gates:` — **uncomment the chosen preset(s), substitute the real module names, and
  delete the presets you didn't pick**, so no dead configuration is left for a later reader to
  trip on.
- Leave `implement.max_changed_loc` at 300 unless the user has a reason; it's the feasibility
  gate's whole point.

## 3. Write `.sdlc/policies/coding-standards.md`

Fill the bracketed sections from the interview: the module/stack/role table, the per-module
library conventions (be specific — name the linter and its config, the logging library, the
validation library), the settings module per module, and any Open gaps found in step 1.4.

Leave the **Non-negotiables** and **Testing** sections alone. They are the template's opinion and
every subagent brief depends on their exact wording.

## 4. Seed `wiki/` and `specs/`

Read `.sdlc/policies/wiki-conventions.md` first and follow its templates exactly.

- `wiki/prd/00-master-prd.md` — the paragraph from step 1.1 as Vision & Goals; link every child PRD.
- `wiki/prd/<module>.md` — one per module, template sections, marked as a stub to be filled by a
  real `/fl-pm` synthesize pass. **Don't invent requirements.**
- `wiki/architecture/00-architecture.md` — the module boundaries as they actually are today.
- `specs/<module>.md` — one per module, the seven-section skeleton, §7 Current State honestly
  recording "not yet specified" rather than a fiction.
- `specs/00-contracts.md` — only the contracts that genuinely already cross modules.
- `wiki/CONTEXT.md` — the terms from step 1.6.
- `wiki/Home.md` and `wiki/_Sidebar.md` — every file above, linked. **This is the step people skip
  and the wiki never recovers from.**

Leave `wiki/plans/_template/` alone — `/fl-pm` copies from it for every new plan.

## 5. GitHub state — ask before each

Everything below is **outward-facing**. Present the full list of what you're about to create and
get one explicit go-ahead.

**Labels** — a component label per module, plus `epic`, `feature`, `task`:
```bash
gh label create <module> --description "Touches the <module> module" --color <hex>
gh label create epic --color <hex>
```
`gh label list` first; never clobber an existing label.

**Project board** (skip when the user declined in step 1.5). Create it, derive the ids, then
provision the five statuses the flow needs. Never hand-write an id.

```bash
gh project create --owner <owner> --title "<repo> board"
gh project list --owner <owner> --format json                   # -> number
gh project view <number> --owner <owner> --format json          # -> project id
gh project field-list <number> --owner <owner> --format json    # -> Status field id + options
```

A new board ships with three statuses (Todo / In Progress / Done). The flow needs five:
**Backlog, Ready, In progress, In review, Done**. Provision them with `updateProjectV2Field`.

**Read first, then write, and keep the ids.** `updateProjectV2Field` replaces the field's entire
option set rather than appending to it. `ProjectV2SingleSelectFieldOptionInput` takes an optional
`id`: resend every existing option **with its id** and the surviving options keep their identity,
so nothing already on the board is orphaned. Omit an id and that option is recreated with a new
one, silently detaching every item sitting in it.

Read the current options:
```bash
gh api graphql -f query='
query($org:String!, $num:Int!){ organization(login:$org){ projectV2(number:$num){
  field(name:"Status"){ ... on ProjectV2SingleSelectField {
    id options { id name color description } } } } } }' \
  -f org=<owner> -F num=<number>
```
(Use `user(login:)` instead of `organization(login:)` for a personal account.)

**Guard before writing.** Count the items already on the board:
```bash
gh project item-list <number> --owner <owner> --format json --jq '.items | length'
```
- **Zero items** — the normal bootstrap case. Safe to provision.
- **Any items**, and the option set you are about to write differs from the one there by more than
  pure additions — **stop.** Show the user the current options, the intended options, and the
  difference, and let them decide. Re-running `/fl-bootstrap` on a live board is not a reason to
  reshuffle statuses that issues are sitting in.

Then write every option, existing ones carrying their ids:
```bash
gh api graphql -f query='
mutation($field:ID!, $opts:[ProjectV2SingleSelectFieldOptionInput!]!){
  updateProjectV2Field(input:{fieldId:$field, singleSelectOptions:$opts}){
    projectV2Field { ... on ProjectV2SingleSelectField { id options { id name } } } } }' \
  -f field=<status_field_id> -F opts='[
    {"id":"<existing id or omit>","name":"Backlog","color":"GRAY","description":"Filed, not ready to build"},
    {"name":"Ready","color":"BLUE","description":"Unblocked and buildable"},
    {"name":"In progress","color":"YELLOW","description":"A worktree is open"},
    {"name":"In review","color":"PURPLE","description":"PR open, awaiting review"},
    {"name":"Done","color":"GREEN","description":"Merged and reconciled"}
  ]'
```
`color` and `description` are **required** on every option; `id` is the only optional one. Valid
colours: `GRAY BLUE GREEN YELLOW ORANGE RED PINK PURPLE`.

Re-run `field-list` afterwards, confirm five options came back, and write their ids into
`github.project.statuses.*` with `project.enabled: true` and a dated comment recording the
commands, so a later 404 is re-derivable.

**Token scopes.** `gh project` needs `read:project` + `write:project`. If `gh auth status` shows
them missing, say so once and give the exact command:
```bash
gh auth refresh -s read:project,write:project
```

## 6. CI

Edit `.github/workflows/ci.yml` so its jobs run **exactly** the commands now in `quality_gates`.
A CI that checks something different from what the reviewer subagent runs is how a branch goes
green locally and red on GitHub. Delete the preset jobs for stacks you're not using.

If `wiki_sync.enabled` is true, `.github/workflows/sync-wiki.yml` needs nothing — but tell the
user the GitHub Wiki must be **initialized once** (create any page in the repo's Wiki tab) before
the mirror works. Until then the workflow skips with a warning rather than failing, so this is a
nudge, not a blocker.

## 7. Verify and report

Run, and show the output:
```bash
grep -n '<[A-Z_]*>' .sdlc/sdlc-config.yml   # must return nothing
make install-dev && make check              # the template's own contract
```
plus every gate command, and a `gh label list`.

`make check` validates that the canonical roles still match both vendor adapters, every skill is
invocable, every Markdown link resolves, wiki links stay inside `wiki/`, and the config you just
wrote matches `schemas/sdlc-config.schema.json`. **A bootstrap that leaves this red isn't
finished.**

Report: the config written, the modules registered, the gates verified (and any left as `TODO`
with the Open-gaps line that records why), the labels and board created, and what still needs a
human in the GitHub UI.

**Handoff:** "Repo bootstrapped. Next: `/fl-pm` to open your first plan — it'll run
`/fl-brainstorm` to shape it."
