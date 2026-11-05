#!/usr/bin/env python3
"""Validate the portable, cross-agent development contract in this repository.

This is the template's own test suite. It checks the things that silently rot:
vendor adapters drifting from the canonical roles, a skill whose frontmatter name
no longer matches its directory, a Markdown link that stopped resolving, a config
that no longer matches its schema.

PyYAML and jsonschema are optional. Without them the config's deep validation is
skipped with a notice rather than failing, so `make check` still works on a bare
Python. CI installs requirements-dev.txt so the full check runs there.
"""

from __future__ import annotations

import json
import re
import sys
import tomllib
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

REQUIRED_FILES = (
    "README.md",
    "AGENTS.md",
    "WORKFLOW.md",
    "CLAUDE.md",
    "HOW_WE_BUILD.md",
    "SETUP.md",
    "Makefile",
    ".codex/config.toml",
    ".sdlc/sdlc-config.yml",
    ".sdlc/policies/coding-standards.md",
    ".sdlc/policies/wiki-conventions.md",
    ".sdlc/policies/writing-standards.md",
    ".vale.ini",
    ".claude/settings.json",
    ".claude/hooks/git-guardrails.sh",
    ".github/workflows/ci.yml",
    ".github/workflows/security.yml",
    ".github/workflows/sync-wiki.yml",
    ".github/scripts/flatten_wiki.py",
    "schemas/sdlc-config.schema.json",
    "specs/README.md",
    "specs/00-contracts.md",
    "specs/00-module-template.md",
    "wiki/Home.md",
    "wiki/_Sidebar.md",
    "wiki/CONTEXT.md",
    "wiki/prd/00-master-prd.md",
    "wiki/prd/decisions/0000-template.md",
    "wiki/architecture/00-architecture.md",
    "wiki/architecture/decisions/0000-template.md",
    "wiki/plans/_template/0-plan_map.md",
)

ROLE_NAMES = {
    "spec-analyst",
    "slice-planner",
    "slice-implementer",
    "reviewer",
    "diff-reviewer",
    "integration-verifier",
}

SKILL_NAMES = {
    "fl-flow",
    "fl-bootstrap",
    "fl-pm",
    "fl-brainstorm",
    "fl-research",
    "fl-prototype",
    "fl-diagnose",
    "fl-implement",
    "fl-pr-review",
    "fl-design",
}

REQUIRED_CONTRACT_PHRASES = (
    "RED → GREEN → REFACTOR",
    "read-only reviewer",
    "Never allow overlapping writers",
    "Agent confidence is not evidence",
    "The human merges",
)

# Commands the v1 flow used. Their reappearance means a doc was reverted.
LEGACY_COMMANDS = ("/autopilot", "/improve-code", "`/grill`", "`/idea`")

# The seven-section spec skeleton. Headings use "N · Title" rather than "N. Title"
# because Google.HeadingPunctuation reads a trailing "N." as a heading ending in a period.
SPEC_SECTIONS = (
    "1 · Purpose & boundary",
    "2 · External surface",
    "3 · Consumed & produced contracts",
    "4 · Invariants",
    "5 · Configuration",
    "6 · Decisions",
    "7 · Current State",
)

CODE_SPAN = re.compile(r"`[^`\n]*`")
FENCE = re.compile(r"```.*?```", re.DOTALL)
LINK = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")
FRONTMATTER_NAME = re.compile(r"^name:\s*(\S+)\s*$", re.MULTILINE)
FRONTMATTER_BLOCK = re.compile(r"\A---\n(.*?)\n---\n", re.DOTALL)
ROUTED_BY = re.compile(r"^routed-by:\s*fl-flow\s*$", re.MULTILINE)
PLAIN_LANGUAGE_TRIGGER = re.compile(r"Use when the user", re.IGNORECASE)
PLACEHOLDER = re.compile(r"<[A-Z][A-Z0-9_]*>")


def _markdown_files(root: Path) -> list[Path]:
    return [
        path
        for path in root.rglob("*.md")
        if ".git/" not in str(path) and ".worktrees/" not in str(path)
    ]


def _check_required_files(root: Path, errors: list[str]) -> None:
    for relative in REQUIRED_FILES:
        if not (root / relative).is_file():
            errors.append(f"missing required file: {relative}")


def _check_parseable(root: Path, errors: list[str]) -> None:
    for path in root.rglob("*.json"):
        if ".git/" in str(path) or "node_modules" in str(path):
            continue
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            errors.append(f"invalid JSON {path.relative_to(root)}: {exc}")

    for path in root.rglob("*.toml"):
        if ".git/" in str(path):
            continue
        try:
            tomllib.loads(path.read_text(encoding="utf-8"))
        except tomllib.TOMLDecodeError as exc:
            errors.append(f"invalid TOML {path.relative_to(root)}: {exc}")


def _check_roles(root: Path, errors: list[str]) -> None:
    """Every vendor adapter must mirror the canonical role set exactly."""
    canonical = {path.stem for path in (root / ".agents/roles").glob("*.md")}
    codex = {path.stem for path in (root / ".codex/agents").glob("*.toml")}
    claude = {path.stem for path in (root / ".claude/agents").glob("*.md")}

    if canonical != ROLE_NAMES:
        errors.append(f"canonical roles {sorted(canonical)} != contract {sorted(ROLE_NAMES)}")
    if codex != ROLE_NAMES:
        errors.append(f"Codex adapters {sorted(codex)} != canonical roles {sorted(ROLE_NAMES)}")
    if claude != ROLE_NAMES:
        errors.append(f"Claude adapters {sorted(claude)} != canonical roles {sorted(ROLE_NAMES)}")

    for name in sorted(canonical & ROLE_NAMES):
        adapter = (root / ".claude/agents" / f"{name}.md").read_text(encoding="utf-8")
        if f".agents/roles/{name}.md" not in adapter:
            errors.append(f".claude/agents/{name}.md does not point at its canonical role file")


def _check_skills(root: Path, errors: list[str]) -> None:
    """A skill's frontmatter name must match its directory, or it can't be invoked."""
    found = set()
    for skill in sorted((root / ".claude/skills").glob("*/SKILL.md")):
        directory = skill.parent.name
        found.add(directory)
        match = FRONTMATTER_NAME.search(skill.read_text(encoding="utf-8"))
        if not match:
            errors.append(f"{skill.relative_to(root)} has no frontmatter name")
        elif match.group(1) != directory:
            errors.append(
                f"skill name mismatch: {skill.relative_to(root)} declares "
                f"{match.group(1)!r} but lives in {directory!r}"
            )
    if found != SKILL_NAMES:
        errors.append(f"skill set {sorted(found)} != contract {sorted(SKILL_NAMES)}")


def _check_router_exclusivity(root: Path, errors: list[str]) -> None:
    """Exactly one skill matches plain language; every other one is routed to it.

    The model selects a skill by matching its `description`. When nine skills each carry
    their own plain-language triggers, the router is one candidate among ten for the same
    sentence and the developer ends up naming the command by hand. See
    wiki/architecture/decisions/2026-09-07-single-entry-two-lanes.md.
    """
    unrouted = []
    for skill in sorted((root / ".claude/skills").glob("*/SKILL.md")):
        name = skill.parent.name
        block = FRONTMATTER_BLOCK.match(skill.read_text(encoding="utf-8"))
        if not block:
            errors.append(f"{name}: SKILL.md has no frontmatter block")
            continue
        frontmatter = block.group(1)
        if not ROUTED_BY.search(frontmatter):
            unrouted.append(name)
            continue
        if f"/{name}" not in frontmatter:
            errors.append(f"{name}: description does not name its own /{name} invocation")
        if PLAIN_LANGUAGE_TRIGGER.search(frontmatter):
            errors.append(
                f"{name}: description carries a plain-language trigger clause — "
                f"those belong to fl-flow, which is the only skill that matches plain language"
            )

    if unrouted != ["fl-flow"]:
        errors.append(
            f"exactly one skill may match plain language; skills without "
            f"'routed-by: fl-flow' are {unrouted} (expected ['fl-flow'])"
        )


def _check_links(root: Path, errors: list[str]) -> None:
    """Every relative Markdown link resolves on disk.

    Code spans and fenced blocks are stripped first: they hold illustrative paths
    that are documentation, not links.
    """
    for path in _markdown_files(root):
        text = CODE_SPAN.sub("", FENCE.sub("", path.read_text(encoding="utf-8")))
        for match in LINK.finditer(text):
            target = match.group(1).split("#")[0]
            if not target or target.startswith(("http://", "https://", "mailto:", "//")):
                continue
            if not (path.parent / target).resolve().exists():
                errors.append(f"broken link in {path.relative_to(root)}: {target}")


def _check_wiki_links_stay_inside(root: Path, errors: list[str]) -> None:
    """flatten_wiki.py only rewrites links that resolve inside wiki/.

    A relative link out of wiki/ survives into the mirrored GitHub Wiki pointing at
    nothing, so it must be a code span or a full URL instead.
    """
    wiki = root / "wiki"
    for path in _markdown_files(wiki):
        text = CODE_SPAN.sub("", FENCE.sub("", path.read_text(encoding="utf-8")))
        for match in LINK.finditer(text):
            target = match.group(1).split("#")[0]
            if not target or target.startswith(("http://", "https://", "mailto:", "//")):
                continue
            resolved = (path.parent / target).resolve()
            if not resolved.is_relative_to(wiki.resolve()):
                errors.append(
                    f"{path.relative_to(root)} links out of wiki/ with a relative path "
                    f"({target}) — the wiki mirror cannot rewrite it; use a code span or full URL"
                )


def _check_workflow_contract(root: Path, errors: list[str]) -> None:
    workflow = (root / "WORKFLOW.md").read_text(encoding="utf-8")
    for phrase in REQUIRED_CONTRACT_PHRASES:
        if phrase not in workflow:
            errors.append(f"WORKFLOW.md is missing contract phrase: {phrase!r}")


def _check_no_legacy_commands(root: Path, errors: list[str]) -> None:
    for relative in ("CLAUDE.md", "AGENTS.md", "WORKFLOW.md", "HOW_WE_BUILD.md"):
        text = (root / relative).read_text(encoding="utf-8")
        for command in LEGACY_COMMANDS:
            if command in text:
                errors.append(f"{relative} still references the retired command {command}")


def _check_spec_template(root: Path, errors: list[str]) -> None:
    text = (root / "specs/00-module-template.md").read_text(encoding="utf-8")
    for section in SPEC_SECTIONS:
        if section not in text:
            errors.append(f"specs/00-module-template.md is missing section: {section!r}")


def _check_config(root: Path, errors: list[str], notices: list[str]) -> None:
    """Validate .sdlc/sdlc-config.yml against its schema, when the deps are present."""
    try:
        import yaml
    except ImportError:
        notices.append("PyYAML not installed — skipped deep config validation (see requirements-dev.txt)")
        return

    path = root / ".sdlc/sdlc-config.yml"
    try:
        config = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        errors.append(f"invalid YAML .sdlc/sdlc-config.yml: {exc}")
        return

    try:
        import jsonschema
    except ImportError:
        notices.append("jsonschema not installed — config parsed but not schema-checked")
        return

    schema = json.loads((root / "schemas/sdlc-config.schema.json").read_text(encoding="utf-8"))
    for error in sorted(jsonschema.Draft202012Validator(schema).iter_errors(config), key=str):
        location = "/".join(str(part) for part in error.absolute_path) or "<root>"
        errors.append(f"sdlc-config.yml does not match schema at {location}: {error.message}")


def _check_bootstrap_state(root: Path, notices: list[str]) -> None:
    """An unbootstrapped template is the expected state, not an error."""
    text = (root / ".sdlc/sdlc-config.yml").read_text(encoding="utf-8")
    remaining = sorted(set(PLACEHOLDER.findall(text)))
    if remaining:
        notices.append(
            f"{len(remaining)} config placeholders remain "
            f"({', '.join(remaining[:3])}{'…' if len(remaining) > 3 else ''}) — run /fl-bootstrap"
        )


def validate(root: Path = REPO_ROOT) -> list[str]:
    errors: list[str] = []
    notices: list[str] = []
    _check_required_files(root, errors)
    _check_parseable(root, errors)
    _check_roles(root, errors)
    _check_skills(root, errors)
    _check_router_exclusivity(root, errors)
    _check_links(root, errors)
    _check_wiki_links_stay_inside(root, errors)
    _check_workflow_contract(root, errors)
    _check_no_legacy_commands(root, errors)
    _check_spec_template(root, errors)
    _check_config(root, errors, notices)
    _check_bootstrap_state(root, notices)
    validate.notices = notices  # type: ignore[attr-defined]
    return errors


def main() -> int:
    errors = validate()
    for notice in getattr(validate, "notices", []):
        print(f"NOTE: {notice}")
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print("Workflow contract OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
