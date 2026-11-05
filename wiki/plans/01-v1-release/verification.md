# 01-v1-release—verification

Filled in by the **integration verifier** before promotion, and kept as the record afterwards.

## Environment

- Date: 2026-11-05
- Runtime: Node 24.22.2 locally. CI runs Node 24 and 26 on Linux, macOS, and Windows
- Server under test: Dovecot 2.4.1 in Docker, and a local SMTP server with TLS and login

## Commands and results

| Command | Result | Evidence |
|---|---|---|
| `npm test` | passing | 158 tests |
| `npm run test:integration` | passing | 58 tests against real Dovecot, including both builds over stdio |
| `npm run lint`, `npm run typecheck`, `npm run format:check` | passing | CI job and local run |
| `npm run build`, `npm run package:mcpb` | passing | manifest validates, bundle runs with no `node_modules` |
| `make check`, `make docs` | passing | template contract and prose gate |

## Acceptance evidence

See [`acceptance.md`](acceptance.md).

## Independent review

An agent with no write access reviewed each pull request. On the server pull request, its review
led to two rounds of fixes: event-loop freezes, hidden-text bypasses, login attempts after a
rejection, a possible double send, and visible text lost from real templates. Its final verdict on
all three pull requests was approval, posted as comments on each.

## Specs and contracts

- [x] Every spec whose described behaviour changed was updated in the same pull request.
- [x] Cross-module contracts checked: there is one module.
- [x] `wiki/architecture/00-architecture.md` matches the system.
- [x] No decision record was superseded.

## Migrations, rollout, and rollback

No migrations. A bad release is withdrawn by marking it as a prerelease, then cutting a fixed version.

## Residual risks

- No real Técnico account, no real Claude Desktop install, and no Windows install was tested.
- Postfix behavior isn't covered, because CI uses a stand-in for SMTP.
- Hidden-text filtering is a best effort, as `specs/server.md` section 7 records.

## Promotion result

Awaiting the owner's merge of the three pull requests and the v1.0.0 tag.
