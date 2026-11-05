#!/usr/bin/env python3
"""Dependency-free guard against common committed credential formats."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SKIPPED = {".git", ".venv", "node_modules", "__pycache__", "dist", "build"}
RULES = (
    ("private key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("OpenAI API key", re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b")),
    ("GitHub token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b")),
    ("AWS access key", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    ("Slack token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b")),
)


def scan_text(text: str) -> list[tuple[int, str]]:
    findings: list[tuple[int, str]] = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        for name, pattern in RULES:
            if pattern.search(line):
                findings.append((line_number, name))
    return findings


def candidate_files(root: Path) -> list[Path]:
    try:
        raw = subprocess.run(
            ["git", "ls-files", "-z"],
            cwd=root,
            check=True,
            capture_output=True,
        ).stdout
        paths = (root / item.decode("utf-8") for item in raw.split(b"\0") if item)
    except (FileNotFoundError, subprocess.CalledProcessError):
        paths = (path for path in root.rglob("*") if path.is_file())
    return sorted(
        path
        for path in paths
        if not any(part in SKIPPED for part in path.parts)
        and path.stat().st_size <= 2_000_000
    )


def scan_repository(root: Path = REPO_ROOT) -> list[str]:
    findings: list[str] = []
    for path in candidate_files(root):
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        findings.extend(
            f"{path.relative_to(root)}:{line}: possible {name}"
            for line, name in scan_text(content)
        )
    return findings


def main() -> int:
    findings = scan_repository()
    if findings:
        print("Potential secrets detected:", file=sys.stderr)
        for finding in findings:
            print(f"- {finding}", file=sys.stderr)
        return 1
    print("Secret scan OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

