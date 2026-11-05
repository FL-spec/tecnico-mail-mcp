# Contracts

Every contract that is **bilateral or wider**—held between two or more modules, where filing
it under one module's spec would wrongly imply that module owns it.

Typical residents: shared message envelopes, event or topic vocabularies, cross-module key
grammars, lifecycle state machines, shared calendar/time functions, and definitions more than
one module must agree on.

A module spec **cites this file by section id** (`§C1`, `§C2`) and never restates its content.
Restating is how two modules end up implementing two different versions of one contract.

Sections are numbered `C1`, `C2`, … and **never renumbered**—a retired contract is marked
retired in place, because module specs cite it by id.

---

## §C1—_(first cross-module contract)_

> **Owner:** shared—no single module.
> **Parties:** _(which modules hold this contract)_

_(The exact shape: schema, field types, required/optional, encoding, versioning rule.)_

**Invariants**

- `CTR-INV-1`—_(individually testable statement)_

---

## Current State

> Every divergence, defect, and surprise in the preceding contracts, as-built. A PR that fixes one
> deletes its entry here in the same change.

- _(none yet)_
