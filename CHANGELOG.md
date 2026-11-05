# Changelog

All notable changes to this template are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- `fl-flow` is the only plain-language entry point. The other `fl-*` skills run when `fl-flow`
  routes to them or when you type their command.
- A plan maps to one GitHub epic, recorded in the plan's map.
- The README drops the v1 migration guide.

### Added

- ADR for the single-entry, two-lane workflow.
- `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, this changelog, and issue forms.

## [2.1.1] - 2026-08-20

### Fixed

- `make docs` works on a fresh clone: the first run downloads the Vale packages.
- The README stated two versions at once.
- Two sentences broken by a Vale autofix.

## [2.1.0] - 2026-08-20

### Added

- `/fl-design`, bound to `specs/design-tokens.md`.
- The prose gate: `make docs` runs Vale with Google style and `signs-of-ai-writing`, and CI
  runs it on every pull request.

## [2.0.0] - 2026-08-20

### Added

- The plan-maturity SDLC: work items advance one next step at a time through `/fl-pm`.
- Vendor-neutral roles in `.agents/roles/`. Claude and Codex each get an adapter per role.
- `make check`: workflow validator, secret scan, and contract tests.

[Unreleased]: https://github.com/FL-spec/Setup/compare/v2.1.1...HEAD
[2.1.1]: https://github.com/FL-spec/Setup/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/FL-spec/Setup/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/FL-spec/Setup/releases/tag/v2.0.0
