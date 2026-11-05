# 2026-11-05—TypeScript with a Desktop Extension as the main install

- **Status:** Accepted
- **Date:** 2026-11-05

## Context

Most users are students, not developers. Claude Desktop ships Node.js and runs `.mcpb` extensions
on it, and the MCPB project itself recommends Node for this reason. A Python server would need
`uv` or a Python install first. `imapflow`, `nodemailer` and `mailparser` cover IMAP, SMTP and
MIME in one family of libraries.

## Decision

Write the server in TypeScript for Node 24 or later, which Claude Desktop ships and `unpdf` needs. Publish a `.mcpb` on every release as the
main install, and an npm package for other clients.

## Consequences

Students install nothing else, and Claude Desktop keeps the password in the OS keychain. The
extension bundles its dependencies into one file, so it must stay free of native modules.

## Alternatives considered

- **Python with FastMCP and `uvx`**—the first design. It needs an extra install on every machine.
- **Forking an existing email MCP server**—it would mean removing multi-account support and
  plaintext password files, and one candidate's LGPL code doesn't fit an MIT repository.
