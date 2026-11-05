# Working from your phone (GitHub Codespaces)

This repo includes a dev container ([.devcontainer/devcontainer.json](.devcontainer/devcontainer.json))
that automatically installs **Claude Code and Codex** in every Codespace, alongside the `gh` command-line tool
and the Node, Python, and Rust toolchains. No PC needs to stay running, and both agents run the
same lifecycle—`AGENTS.md` and `WORKFLOW.md` are the canonical contract for each.

## First time

1. Open the repo on GitHub.
2. Tap the green **Code** button → **Codespaces** tab → **Create codespace on main**.
3. Wait for the dev container to build (it installs Claude Code on first create).
4. In the Codespace terminal:

   ```bash
   claude
   ```

5. Follow the login prompt to authenticate Claude Code (one-time, opens in the browser).
6. On a brand-new project, run `/fl-bootstrap` first. On an existing one, just say what you want
   in plain language—the agent detects where the project is and continues from there.

   To use Codex instead, run `codex` in the same terminal. It reads `AGENTS.md`, `WORKFLOW.md`
   and `.codex/agents/`, which mirror the same roles.

## GitHub access

The `fl-*` flow is GitHub-native, so `gh` needs to be authenticated:

```bash
gh auth status
```

A Codespace usually inherits a token with `repo` scope, which covers issues and pull requests—
everything except the project board. If you use a board:

```bash
gh auth refresh -s read:project,write:project
```

If you'd rather not, set `github.project.enabled: false` in `.sdlc/sdlc-config.yml`. The flow
works from issue state alone; only the board moves are skipped.

## The wiki mirror

`wiki/` is mirrored to the repo's GitHub Wiki by `.github/workflows/sync-wiki.yml` on every push
to `main` that touches it. **The wiki has to be initialized once by hand**—open the repo's
**Wiki** tab and create any page. Until you do, the sync workflow skips with a warning instead of
failing, so a fresh clone is never red; nothing else in the flow depends on the mirror.

Don't edit pages in the GitHub Wiki UI: it's a mirror, and the next sync overwrites them. Edit
`wiki/` in the repo.

## Day to day

- Reopen your existing Codespace from [github.com/codespaces](https://github.com/codespaces) (faster than creating one).
- Run `claude` and work as normal.
- Worktrees created by `/fl-implement` live in `.worktrees/` and are gitignored.
- Before committing template changes, run `make check`—CI runs the same gate.
- Commit and push when done:

  ```bash
  git add .
  git commit -m "your message"
  git push
  ```

## Tips

- **Phone browser:** the Codespaces web editor works in mobile Safari/Chrome. Request the desktop
  site for a better terminal experience.
- **Stop when idle:** Codespaces bill by usage. Stop yours from [github.com/codespaces](https://github.com/codespaces)
  when you're done. Stopped Codespaces keep your files; they just don't run.
- **If Claude Code isn't found** after opening a Codespace, install it manually:

  ```bash
  npm install -g @anthropic-ai/claude-code
  ```
