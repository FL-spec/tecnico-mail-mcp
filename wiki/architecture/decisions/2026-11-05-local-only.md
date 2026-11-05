# 2026-11-05—Run locally, never hosted

- **Status:** Accepted
- **Date:** 2026-11-05

## Context

DSI documents normal password login for mail, and the same password opens Fénix. A hosted server
would hold other people's passwords. Técnico's acceptable use rules treat sharing an account or
password as unethical without prior approval.

## Decision

Each person runs the server on their own machine, with their own credentials. There is no hosted
version and no telemetry.

## Consequences

No central store of passwords can leak. Each user installs something, so install must be easy,
and the project can't see usage or errors.

## Alternatives considered

- **Hosted server with a login page**—a single breach would expose every user's Técnico account.
