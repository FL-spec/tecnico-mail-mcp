# specs/

The **exact-contract layer**—schemas, interfaces, file formats—that implementers follow
**blindly**. One file per module in `.sdlc/sdlc-config.yml`'s `modules:`, plus
[`00-contracts.md`](00-contracts.md) for anything held between two or more modules.

`/fl-bootstrap` seeds one file per module from the skeleton below; `/fl-pm` keeps them current,
and `/fl-pm`'s post-merge reconcile updates §7 after every merge.

## The skeleton—every module spec has these seven sections

```
1 · Purpose & boundary      — what the module owns; explicitly what it must not do
2 · External surface        — the exact contract, module-shaped
3 · Consumed & produced contracts — pointers into 00-contracts.md, not restatements
4 · Invariants              — numbered and module-prefixed (WEB-INV-1, API-INV-1),
                             each individually testable
5 · Configuration           — env vars, ports, defaults
6 · Decisions               — links to the ADRs that bear on the module
7 · Current State           — every divergence, defect and surprise
```

## The rule that makes specs worth having

Specs describe the system **as-built, never as-intended.** Where the code and a design document
disagree, **the code wins**, and the divergence is recorded in §7 with an ADR explaining it.

A pull request that changes behaviour a spec describes **updates that spec in the same PR**—
see the non-negotiable in [`.sdlc/policies/coding-standards.md`](../.sdlc/policies/coding-standards.md).
A spec that lags a merged change is worse than no spec, because the next implementer trusts it.
