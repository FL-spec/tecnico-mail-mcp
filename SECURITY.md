# Security policy

This tool holds a password that also opens Fénix, reads mail from anyone, and can send mail as you.
Problems that could expose any of that count as security issues.

## Report a vulnerability

Report it privately through
[GitHub private vulnerability reporting](https://github.com/FL-spec/tecnico-mail-mcp/security/advisories/new).
Don't open a public issue, and don't send real mail or real credentials in a report.

Include the steps that reproduce it, the version (`tecnico-mail-mcp --version`), and what an attacker
gains. Expect an acknowledgement within seven days. Only the latest release receives fixes.

This is an independent project. Report problems with Técnico's mail service to DSI instead.

## Security model

### What it protects

| Asset | How |
| --- | --- |
| Your password | Stored in the OS keychain. Sent only to the configured mail server, over TLS with verified certificates. No option turns verification off. Never logged or returned by a tool. |
| Your mail | Read on demand, kept in memory only for the call, and never written to disk or logged. |
| Your account | One connection, spaced operations, and no retry after a rejected login. Sending stays below DSI's limits. |
| Your outgoing mail | Sending is off by default, with no attachments. |

### What leaves your computer

- **To `mail.tecnico.ulisboa.pt`:** your Técnico ID and password, and the mail you send or draft.
- **To your AI provider:** whatever the tools return, through your client. That's the provider's
  data handling, not this project's. Check it before reading confidential mail through an AI.
- **To anyone else:** nothing. There is no telemetry and no update check.

### What it can't protect against

**Prompt injection.** An email can contain text that tries to make the model do something. The
server removes hidden text and tells the model that mail is data, and this reduces the risk without
removing it. A model could still be misled by visible text. So:

- Keep the default mode, or `--read-only`, unless you need sending.
- If you use `--allow-send`, read each confirmation prompt before you approve a send. MCP annotations
  mark sending as destructive, but a client decides what to do with them.
- A manipulated model could still move messages or save drafts in the default mode. It can't send,
  and it can't permanently delete.

**A compromised computer.** Malware running as you can reach your keychain and your mail client.

**A plaintext config.** If you use `TECNICO_PASSWORD`, anything that can read that file has your
password. Prefer `login` or the extension.

**A malicious update.** `latest` always fetches the newest release. To control updates, pin a version,
as [other clients](docs/clients.md) explains, and verify it.

## Verify a release

CI builds every release from a tag, with GitHub Actions pinned to commit hashes, and signs its
provenance with Sigstore. To check a file you downloaded:

```bash
gh attestation verify tecnico-mail.mcpb --repo FL-spec/tecnico-mail-mcp
```

Each release also lists `SHA256SUMS`.

## Rules for using it

Técnico's acceptable use rules apply to you. Use only your own account. Don't share your password or
use the tool for mass mail, which needs prior approval from Técnico. This project has no connection
with those rules' authors, and this summary isn't legal advice.
