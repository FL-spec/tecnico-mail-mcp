# 01-v1-release—acceptance

Criterion-to-evidence traceability. One row per acceptance criterion across every issue this plan
produced. The **integration verifier** fills the evidence columns; agent confidence is not
evidence.

| Criterion | Issue | Slice | Automated evidence | Manual evidence | Status |
|---|---|---|---|---|---|
| Rejects email as ID, ist-form address; env over file; placeholders unset | #2 | S1 | test/unit/config.test.ts | | passing |
| Login tests both protocols before saving; no password in config; keychain fallback; logout removes | #3 | S2 | test/unit/commands.test.ts; real macOS keychain round trip with a dummy value | | passing |
| New client on reconnect; wrong password stops attempts; reads retry once; doctor reports | #4 | S3 | test/integration/session.test.ts; test/unit/commands.test.ts | | passing |
| Folders with counts and roles; Portuguese names; clean stdout | #5 | S4 | test/integration/read-tools.test.ts; test/unit/folders.test.ts; test/integration/stdio.test.ts | | passing |
| Charsets decode; hidden HTML dropped; invisible Unicode removed | #6 | S5 | test/unit/parse.test.ts; test/unit/html.test.ts | | passing |
| All filters including accents; newest first, capped; never marks read | #7 | S6 | test/integration/read-tools.test.ts | | passing |
| No Seen flag; no inline images; truncation reported | #8 | S7 | test/integration/read-tools.test.ts; test/unit/parse.test.ts | | passing |
| PDF, DOCX, text extract; others refused; zip bomb refused | #9 | S8 | test/unit/attachments.test.ts; test/integration/write-tools.test.ts | | passing |
| RFC 2047; CR or LF refused; Draft flag in detected folder; threaded reply draft | #10 | S9 | test/unit/compose.test.ts; test/integration/write-tools.test.ts | | passing |
| Bcc hidden; Sent copy; budget before network; send survives failed copy | #11 | S10 | test/integration/write-tools.test.ts; test/unit/budget.test.ts | | passing |
| Threading; Re: never stacks; reply_all list guard | #12 | S11 | test/unit/compose.test.ts; test/integration/write-tools.test.ts | | passing |
| Each mode has exactly its tools; annotations; UID caps; default has no send | #13 | S12 | test/unit/server.test.ts; test/integration/stdio.test.ts | | passing |
| mcpb validate passes; bundle runs with no node_modules; tag makes a release | #14 | S13 | test/integration/stdio.test.ts; release run of v1.0.0-rc.1 | | pending |
| Commands and claims verified; disclaimer and privacy note; community 100% | #15 | S14 | GitHub community profile API returned 100 | | passing |
| Install in real Claude Desktop on clean Mac and Windows | #14 | S13 | none: needs a person | | blocked |
| doctor on a real Técnico account | #4 | S3 | none: needs the owner's password | | blocked |
| Beta with 5 to 10 classmates | none | none | none: needs people | | blocked |

Allowed states: `pending`, `passing`, `failing`, `blocked`, `not_applicable`.

A criterion with no automated evidence and no stated reason is **not** `passing`.
