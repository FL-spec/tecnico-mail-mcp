# Contributing

Bug reports and pull requests are welcome. Test only with your own mailbox or with fictional mail,
and keep real mail, names, and passwords out of issues, tests, and commits.

## Set up

You need Node.js 24 or later. The integration tests need Docker, and they start a real Dovecot
server.

```bash
git clone https://github.com/FL-spec/tecnico-mail-mcp.git
cd tecnico-mail-mcp
npm ci
```

## Run the checks

CI runs all of these, and `.sdlc/sdlc-config.yml` lists them as the project's quality gates.

```bash
npm run typecheck && npm run lint && npm run format:check
```

```bash
npm test
```

```bash
npm run test:integration
```

```bash
npm run build
```

To try your build with your own mailbox, log in, then run `doctor`, which changes nothing:

```bash
node dist/index.js login
```

```bash
node dist/index.js doctor
```

## Change something

1. Open an issue first for anything beyond a small fix.
2. Branch from `main`, and write a failing test first. Bug fixes start with a test that reproduces
   the bug.
3. If you change behavior that [`specs/server.md`](specs/server.md) describes, update the spec in the
   same pull request.
4. Use commit messages in the form `type(scope): imperative summary`, such as
   `fix(imap): reconnect after a timeout`.

## Project rules

- **Ask before adding a dependency.** People trust this code with a password, so it stays small and
  easy to audit.
- **No secret or mail content goes in a log, an error, or stdout.** Stdout belongs to the protocol.
- **No option may turn off TLS verification.**
- **Treat every email as hostile input.**
- **Features that send mail stay off by default,** and bulk sending is out of scope.

## How this repository is organized

| Path | Holds |
| --- | --- |
| `src/` | the server |
| `test/` | unit and integration tests |
| `docs/` | documentation for users |
| `specs/` | the exact contract of the server |
| `wiki/` | the product requirements, architecture, decisions, and plans |
| `AGENTS.md`, `WORKFLOW.md`, `.claude/`, `.agents/`, `.codex/` | the spec-driven workflow from the [Setup template](https://github.com/FL-spec/Setup) |

Prose also has a gate, which needs [Vale](https://vale.sh/):

```bash
make docs
```

`make check` validates the workflow files and scans for secrets. It needs Python 3.11 or later.

## Code of conduct

This project follows the [Contributor Covenant](.github/CODE_OF_CONDUCT.md).
