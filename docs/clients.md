# Other clients

Claude Desktop users should install the [extension](../README.md#install). This page covers
everything else. You need [Node.js](https://nodejs.org) 24 or later.

Every command below installs from the latest GitHub release. Pin a version by replacing
`latest/download` with `download/vX.Y.Z`, so an update can't reach you without you choosing it.

## Step 1: log in once

Run this in a terminal. It asks for your Técnico ID, email address, and password, tests both logins
before saving anything, and stores the password in your OS keychain.

```bash
npx -y --package=https://github.com/FL-spec/tecnico-mail-mcp/releases/latest/download/tecnico-mail-mcp.tgz tecnico-mail-mcp login
```

## Step 2: add the server to your client

### Claude Code

```bash
claude mcp add tecnico-mail -- npx -y --package=https://github.com/FL-spec/tecnico-mail-mcp/releases/latest/download/tecnico-mail-mcp.tgz tecnico-mail-mcp
```

### Cursor, VS Code, and other JSON configs

Add this to the client's MCP config (`.cursor/mcp.json`, or `mcp.json` in VS Code, which names the
top-level key `servers`):

```json
{
  "mcpServers": {
    "tecnico-mail": {
      "command": "npx",
      "args": [
        "-y",
        "--package=https://github.com/FL-spec/tecnico-mail-mcp/releases/latest/download/tecnico-mail-mcp.tgz",
        "tecnico-mail-mcp"
      ]
    }
  }
}
```

## Choose an access mode

Add a flag after `tecnico-mail-mcp`:

| Flag | Tools |
| --- | --- |
| none | read, drafts, flags, moves |
| `--read-only` | read only |
| `--allow-send` | everything, including sending |

## Machines without a keychain

Headless Linux machines often have no keychain. Set these variables in the client's config instead:

| Variable | Value |
| --- | --- |
| `TECNICO_ID` | your Técnico ID, `istxxxxx` |
| `TECNICO_EMAIL` | your Técnico address |
| `TECNICO_PASSWORD` | your password |
| `TECNICO_NAME` | your name on sent mail (optional) |

This is the less safe option: the password sits in a plaintext file, and a command with `-e` leaves
it in your shell history. That password also opens Fénix, so use `login` wherever you can.

## Remove it

```bash
npx -y --package=https://github.com/FL-spec/tecnico-mail-mcp/releases/latest/download/tecnico-mail-mcp.tgz tecnico-mail-mcp logout
```
