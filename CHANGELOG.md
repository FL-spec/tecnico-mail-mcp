# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0

First public release.

### Added

- Read tools: `list_folders`, `search_messages`, `get_message`, and `get_attachment`, with text
  extraction from PDF, DOCX, HTML, and plain text.
- Organizing tools: `create_draft`, `mark_read`, `flag`, and `move_message`.
- Sending tools, off by default: `send_message` and `reply`.
- Three access modes: read-only, default, and `--allow-send`.
- A Claude Desktop extension, with the password in the OS keychain.
- `login`, `logout`, and `doctor` commands for other clients.
- Local sending limits below DSI's.
- Removal of hidden HTML and invisible Unicode from everything a tool returns.
