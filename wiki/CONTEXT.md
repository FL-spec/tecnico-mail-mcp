# CONTEXT.md—Domain Language

The shared vocabulary for this project. **Every fuzzy term gets pinned here the moment it comes
up**, so agents and humans mean the same thing.

This file is loaded into every coder and reviewer subagent and it **outlives every feature**—
it is part of the long-term source of truth, alongside code, tests, `specs/`, and the decision
records. A term that only got pinned in conversation is a term the next subagent gets wrong.

## Glossary

> One row per term. Pin the meaning, and **call out collisions explicitly**—the third column
> is the one that earns its keep.

| Term | Means | Not to be confused with |
| ---- | ----- | ----------------------- |
| _(term)_ | _(precise definition)_ | _(the thing it's often confused with)_ |
| For example, **Account** | the billing entity (a `Customer`) | a login (a `User`) |

## Domain rules

> Invariants that are always true in this domain, in business language. The testable,
> module-scoped versions live in each spec's §4.

- _(none yet)_

## Boundaries

> What lives where—the major modules and what each one owns. The exact contracts are in
> `specs/`; this is the one-line orientation.

- _(none yet)_
