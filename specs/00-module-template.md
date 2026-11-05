# specs/<module>.md—template

> Copy to `specs/<module>.md`, one per module. Keep all seven sections, in this order, even when
> a section is empty—a missing section reads as an oversight, an empty one reads as a fact.
> Prefix invariants with the module's short code (`API-INV-1`, `WEB-INV-1`).

## 1 · Purpose & boundary

What this module owns. **And explicitly what it must not do**—the second half is what stops
boundary erosion.

## 2 · External surface

The exact contract this module exposes: routes, function signatures, message shapes, file
formats. Types and required/optional status stated, not implied.

## 3 · Consumed & produced contracts

Pointers into [`00-contracts.md`](00-contracts.md) by section id (`§C1`, `§C2`)—**never
restatements**.

| Direction | Contract | Counterparty |
| --- | --- | --- |
| consumes | `§C1` | _(module)_ |
| produces | `§C2` | _(module)_ |

## 4 · Invariants

Numbered, module-prefixed, and **each individually testable**. An invariant nobody could write
a test for is a wish, not an invariant.

- `<MOD>-INV-1`—_(…)_

## 5 · Configuration

| Env var | Required | Default | Meaning |
| --- | --- | --- | --- |
| _(NAME)_ | yes/no | _(default)_ | _(…)_ |

## 6 · Decisions

Links to the ADRs in `wiki/architecture/decisions/` that bear on this module. Superseded ones
stay listed and marked.

## 7 · Current State

Every divergence, defect, and surprise, as-built. Short inline pointers in the body
(`(unreachable—see §7)`) rather than caveats scattered through the contract.

A PR that fixes a defect recorded here **deletes its entry** in the same change.

- _(none yet)_
