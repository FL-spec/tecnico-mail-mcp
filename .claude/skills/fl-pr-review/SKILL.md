---
name: fl-pr-review
description: >
  Two-axis review (Standards + Spec) of the changes since a fixed point — commit, branch, tag,
  or merge-base — published as one real GitHub PR review with inline comments and suggestions.
  Invoked by fl-flow, or when the user types /fl-pr-review <base>.
routed-by: fl-flow
---

# PR Review

You are the **orchestrator**, in the main thread. You gather the inputs, hand the diff review to
a subagent, then assemble its findings into one GitHub PR review and submit it. The diff is the
subagent's to judge; **you never review it yourself and never modify code.** The event you submit
is `COMMENT` or `REQUEST_CHANGES` — the user reviews and merges.

**The review brief** is `diff-review.md`, beside this file. You never read it yourself; you pass
the subagent its absolute path and tell it to follow that file.

Board hygiene isn't this skill's job. A finding here is a **claim**, and whether it survives
contact with the code is decided by triage — `/fl-implement` step 8 — which is therefore where
the issue moves back to In progress. Leave the status alone and let the report speak; where your
findings land the user, close with a pointer to that step.

## Configuration

Read `.sdlc/sdlc-config.yml` at the repo root (`git rev-parse --show-toplevel`) for
`github.slug` (every `gh api` path below) and `default_branch`.

## Inputs
- **The fixed point** — whatever the user said: a commit SHA, branch name, tag, the default
  branch, `HEAD~5`. If they didn't give one, ask.
- Optionally a **PR number** (e.g. `/fl-pr-review 195`); otherwise resolve it from the branch.
- Optionally an **issue number or spec path**, if the user names one — the subagent resolves its
  own spec source when you don't.

## Process

### 1. Pin the diff
```bash
git rev-parse <fixed-point>
git diff <fixed-point>...HEAD --stat
```
A bad ref or empty diff fails here, before a subagent is spawned.

### 2. Resolve the PR
```bash
gh pr list --head <branch> --json number --jq '.[0].number'   # if not given directly
gh pr view <PR> --json number,headRefOid,headRefName,baseRefName,url
```
With **no open PR** for the branch, tell the user and run read-only: do step 3, relay the report
as text, and stop — steps 4–6 have nowhere to publish.

### 3. Spawn the review
Spawn the `diff-reviewer` subagent (canonical role: `.agents/roles/diff-reviewer.md`; use
`subagent_type: diff-reviewer`, or `general-purpose` if that agent isn't available). Its prompt:
**read `<this skill's directory>/diff-review.md` and follow it**, with the fixed point
and any spec pointer the user gave. Wait for its structured report — `## Standards` / `## Spec` /
`## Summary`, each finding carrying `File:`/`Line:`/`Side:` and an optional `Suggestion:` block.
Relay its findings as they came; **the ranking and the wording are the subagent's.**

### 4. Assemble the review draft
Split the findings into **anchored** (a real `File:`/`Line:`, not `n/a`) and **unanchored**.
Anchored ones become inline review comments; unanchored ones fold into the review's top-level
body under a "Findings without a line anchor" heading.

Build the payload with `jq`, **not hand-spliced strings** — quoted hunks and suggestion blocks
carry quotes and backticks that break naive JSON interpolation:
```bash
review_dir=$(mktemp -d)
mkdir -p "$review_dir/comments"

# one JSON object per anchored finding — repeat for each, i is a running counter
printf '%s' "<finding body: **[Standards|Spec] <title>**\n\n<prose/hunk>\n\n<suggestion block if present>>" \
  > "$review_dir/comments/$i.md"
jq -n --arg path "<path>" --argjson line <line> --arg side "<RIGHT|LEFT>" \
  --rawfile body "$review_dir/comments/$i.md" \
  '{path:$path, line:$line, side:$side, body:$body}' > "$review_dir/comments/$i.json"

# merge all comment objects into one array (empty array if there were none)
jq -s '.' "$review_dir"/comments/*.json > "$review_dir/comments.json" 2>/dev/null || echo '[]' > "$review_dir/comments.json"

# unanchored findings + header go into the top-level review body
printf '%s' "<unanchored findings section, or empty>" > "$review_dir/unanchored.md"

jq -n --arg commit "<headRefOid>" --rawfile body "$review_dir/unanchored.md" --slurpfile comments "$review_dir/comments.json" \
  '{commit_id:$commit, body:$body, comments:$comments[0]}' > "$review_dir/review.json"
```

Create the review as a **pending draft** — no `event` field, which both starts the review and
attaches every comment and suggestion in one call:
```bash
review_id=$(gh api repos/<github.slug>/pulls/<PR>/reviews \
  -X POST --input "$review_dir/review.json" --jq '.id')
```
A **422** means one comment's line/side doesn't resolve against the current diff: drop that
comment from `comments.json`, fold its text into `unanchored.md`, and retry — one bad anchor
never blocks the whole review.

### 5. Submit
Compose the final body — header plus the subagent's `## Summary` section:
```bash
cat > "$review_dir/submit_body.md" <<EOF
## PR Review Report

**Reviewed by:** fl-pr-review · <Model Name>
**Fixed point:** \`<sha>\` (merge-base with \`<default_branch>\`)
**Branch:** \`<branch>\`
**Spec:** Issue #<NNN> (or n/a)

---

<subagent's ## Summary section verbatim>
EOF

gh api repos/<github.slug>/pulls/<PR>/reviews/<review_id>/events \
  -X POST -f event="<COMMENT|REQUEST_CHANGES>" -F body=@"$review_dir/submit_body.md"
```
**`-F`/`--field`, not `-f`/`--raw-field`, is what makes `@file` expand to the file's contents** —
with `-f` the path itself gets posted as the review body. Safest alternative: expand it yourself
— `body_content=$(cat "$review_dir/submit_body.md"); gh api ... -f body="$body_content"`.

Use the subagent's **Recommended review event** verbatim. **`APPROVE` is never an option here.**

### 6. Verify, then report
Fetch the posted review back and confirm the body holds the report, not a literal `@`-prefixed
path or an empty string:
```bash
gh api repos/<github.slug>/pulls/<PR>/reviews/<review_id> --jq '.body'
```
An empty or `@`-prefixed body means the file interpolation silently failed — repair it with
`PATCH repos/<github.slug>/pulls/<PR>/reviews/<review_id>` (`-f body="$(cat file)"`) before
reporting success.

Tell the user the review's URL (`gh api .../reviews/<review_id> --jq .html_url`), how many inline
comments were posted, and the event used. If the publishing path was skipped for want of a PR,
say so plainly.

**Handoff:** "Review submitted (<event>, <N> inline comments): <url>. Next: `/fl-implement <PR#>`
to triage and drive every thread to resolved."
