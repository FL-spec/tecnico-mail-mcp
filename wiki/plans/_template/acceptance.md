# <NN>-<slug>—acceptance

Criterion-to-evidence traceability. One row per acceptance criterion across every issue this plan
produced. The **integration verifier** fills the evidence columns; agent confidence is not
evidence.

| Criterion | Issue | Slice | Automated evidence | Manual evidence | Status |
|---|---|---|---|---|---|
| AC-1 | #NNN | S1 | _(test name + command)_ | _(what was observed)_ | pending |

Allowed states: `pending`, `passing`, `failing`, `blocked`, `not_applicable`.

A criterion with no automated evidence and no stated reason is **not** `passing`.
