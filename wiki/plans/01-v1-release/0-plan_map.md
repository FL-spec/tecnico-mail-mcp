# 01-v1-release—plan map

- **Epic:** #1
- **Status:** active
- **Date:** 2026-11-05

## Summary

Ship version 1.0.0: an MCP server any Técnico user installs locally to reach their own mailbox,
with a Desktop Extension, an npm package, full tests against Dovecot, and professional docs.

## Work items

| Work item | Next step | Description | Status |
|---|---|---|---|
| Foundation | implement | settings, credentials, errors, session, doctor, and login | open |
| Read tools | implement | folders, search, message, and attachment tools | open |
| Write tools | implement | drafts, sending, flags, moves, and access modes | open |
| Distribution | implement | extension, release workflow, and supply chain | open |
| Documentation | implement | README, docs, demo, and community files | open |

## Human gates

The template asks a human to read the documentation before issues exist, and to merge every pull
request. On 2026-11-05 the project owner told the agent to do everything without stopping, so the
agent cut the issues straight away. Merging stays a gate: each pull request gets an independent
review and green checks first.

## Acceptance and verification

See [`acceptance.md`](acceptance.md) and [`verification.md`](verification.md).
