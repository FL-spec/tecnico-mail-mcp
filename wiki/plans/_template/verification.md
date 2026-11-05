# <NN>-<slug>—verification

Filled in by the **integration verifier** before promotion, and kept as the record afterwards.

## Environment

- Feature commit:
- Reconciled `main` commit:
- Date (absolute):
- Runtime / toolchain versions:

## Commands and results

> The exact commands, taken verbatim from `quality_gates` in `.sdlc/sdlc-config.yml`, plus
> `make check`. A gate whose command is a `TODO` placeholder is recorded as such, never as passed.

| Command | Result | Evidence |
|---|---|---|
| _(command)_ | pending | _(output summary)_ |

## Acceptance evidence

_[Pointer to `acceptance.md`, plus anything that needed judgement.]_

## Independent review

_[Reviewer verdict per slice, and how blocking findings were resolved.]_

## Specs and contracts

- [ ] Every spec whose described behaviour changed was updated **in the same PR**.
- [ ] Cross-module contracts checked: did this change what one module exposes to another?
- [ ] `wiki/architecture/00-architecture.md` updated if the system shape changed.
- [ ] Superseded decision records marked, not deleted.

## Migrations, rollout, and rollback

## Residual risks

## Promotion result

- Pull request:
- Remote checks:
- Merge commit:
- Final `main` commit:
