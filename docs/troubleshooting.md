# Troubleshooting

Start with `doctor`, if you installed through the command line. It checks both logins and prints
your folders. It changes nothing, and prints no mail and no password.

```bash
npx -y --package=https://github.com/FL-spec/tecnico-mail-mcp/releases/latest/download/tecnico-mail-mcp.tgz tecnico-mail-mcp doctor
```

## Login

**"The Técnico mail server refused the login."** The username must be your Técnico ID (`istxxxxx`),
not your email address. Check that the password works at
[webmail](https://webmail.tecnico.ulisboa.pt). Then restart your client, because the server stops
trying after one rejected login, which protects your account from a lockout.

**"This looks like an email address."** The error names the value. You put your address in the Técnico ID field. The ID has the
form `istxxxxx`.

**"A Técnico address never has the form istxxxxx@tecnico.ulisboa.pt."** Use the address you chose at activation,
such as `ana.silva@tecnico.ulisboa.pt`.

**"No Técnico account is configured."** In Claude Desktop, open the extension's settings and fill
them in. Elsewhere, run `login` as [other clients](clients.md) explains.

**Login works in webmail but not here, and it did before.** DSI may have changed how mail login
works, for example by adding multi-factor login. Check DSI's announcements, and
[open an issue](https://github.com/FL-spec/tecnico-mail-mcp/issues).

## Keychain

**"This machine has no usable keychain."** Common on headless Linux. Install and unlock a Secret
Service provider such as GNOME Keyring, or use
[environment variables](clients.md#machines-without-a-keychain), which is less safe.

## Sending

**Claude says it can't send mail.** Sending is off by default. Turn on "Allow sending" in the
extension's settings, or add `--allow-send`, and restart. Drafts work without it.

**"The mail server refused this message."** Check the addresses. You may also have reached DSI's
limits: 200 emails in 5 minutes, 450 per hour, or 500 per day, counting each recipient. Reaching the
daily limit blocks sending for 24 hours.

**"This would exceed the local limit."** This server's own cap, which keeps you away from DSI's
block. Wait, or restart the server if you're sure.

**A recipient didn't get the message, or it's in spam.** Check that your email address setting is your real
Técnico address. Técnico's anti-spoofing checks can reject a wrong one.

## Reading

**A search finds nothing, but the mail is there.** `since` and `before` use the date the server
received the message. Search works on one folder at a time, `INBOX` by default.

**An attachment has no text.** Scanned PDFs hold images. Open them in webmail.

## Starting

**Node version errors in `npx`.** You need Node 24 or later. Check with `node --version`. The
Claude Desktop extension uses Claude's own Node and doesn't need this.

**Your client can't find `npx`.** Desktop apps on macOS may not see your shell's `PATH`. Put the full
path, from `which npx`, in the `command` field.

**It looks stuck when run in a terminal.** With no command, it's an MCP server waiting for a
client on stdin. Your AI client starts it for you. Press Ctrl+C.
