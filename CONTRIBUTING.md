# Contributing

Thanks for helping improve the template. Changes here land in every project created from it, so
the bar is that `make check` and `make docs` pass and that the change keeps Claude and Codex in
step.

## Set up

You need Python 3.11 or later, [Vale](https://vale.sh/), and an authenticated `gh`.

```bash
gh repo clone FL-spec/Setup
cd Setup
make install-dev
```

`make install-dev` adds the libraries that turn on deep validation of `.sdlc/sdlc-config.yml`
against its JSON Schema.

## Make a change

1. Branch from `main`.
2. Edit the canonical file first. Roles live in `.agents/roles/`, and the delivery state machine
   lives in `WORKFLOW.md`. Then update the adapters in `.claude/agents/` and `.codex/agents/` to
   match.
3. Run both gates:

   ```bash
   make check
   ```

   ```bash
   make docs
   ```

4. Open a pull request and fill in the template.

`make check` fails if a role and its adapters drift apart, a skill can't be invoked, a Markdown
link breaks, or the config stops matching its schema. `make docs` fails on any Vale warning. The
rules, and why two Google rules are off, are in
[writing-standards.md](.sdlc/policies/writing-standards.md).

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `docs`,
`refactor`, `chore`, with a scope where it helps, as in `docs(skills): …`.

## Record notable changes

Add a line under **Unreleased** in [CHANGELOG.md](CHANGELOG.md) for anything a project using the
template would notice.

## Code of conduct

Taking part means following the [code of conduct](.github/CODE_OF_CONDUCT.md).
