#!/usr/bin/env bash
# git-guardrails — PreToolUse hook for Bash.
# Blocks destructive git operations and obvious secret leaks.
# Protocol: exit 2 + stderr message => the tool call is blocked and the
# message is shown to Claude. Exit 0 => allow.

set -euo pipefail

# Read the hook payload and extract the command being run.
payload="$(cat)"
cmd="$(printf '%s' "$payload" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null || true)"

[ -z "$cmd" ] && exit 0

block() { echo "git-guardrails: $1" >&2; exit 2; }

# --- Destructive git operations -------------------------------------------
case "$cmd" in
  *"git push"*"--force"*|*"git push"*"-f"*)
    block "force-push blocked. Use --force-with-lease only after a deliberate decision." ;;
  *"git reset --hard"*)
    block "git reset --hard blocked — it discards uncommitted work. Stash or commit first." ;;
  *"git clean -"*[fd]*)
    block "git clean -f/-d blocked — it deletes untracked files irreversibly." ;;
  *"git checkout"*".")
    block "git checkout . blocked — it discards working-tree changes. Be explicit about paths." ;;
  *"git branch -D"*)
    block "force-delete of a branch blocked. Use -d (safe delete) or confirm manually." ;;
  *"git filter-branch"*|*"git reflog expire"*|*"git gc --prune=now"*)
    block "history-rewriting command blocked." ;;
esac

# --- Obvious secret leaks --------------------------------------------------
case "$cmd" in
  *"git add"*".env"*|*"git commit"*".env"*)
    block "looks like you're committing a .env file. Secrets must never be committed." ;;
esac

exit 0
