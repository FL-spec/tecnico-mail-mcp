#!/usr/bin/env python3
"""Flatten wiki/ into the page namespace a GitHub wiki actually has.

A GitHub wiki has no directories in its URL space: a file committed to the wiki
repo at `plans/05-x/0-plan_map.md` is served at `/wiki/0-plan_map` -- the
basename only. Every path-bearing link 404s, and two files sharing a basename
collide onto one page (six `0-plan_map.md` files would leave five unreachable).

So `wiki/` in this repo keeps a directory tree with ordinary relative `.md`
links -- correct in VS Code and in the GitHub repo browser -- and this script
does the transform at publish time:

    wiki/plans/05-x/0-plan_map.md   ->  plans-05-x-0-plan_map.md
    [item 14](../05-x/14-foo.md)    ->  [item 14](plans-05-x-14-foo)

Root-level pages (Home, _Sidebar, _Footer) keep their names -- the wiki looks
those up by exact name. `sources/` is not published.

Usage: flatten_wiki.py <wiki-dir> <output-dir>
"""

from __future__ import annotations

import os
import re
import sys

EXCLUDED_DIRS = {"sources"}
LINK = re.compile(r"(!?\[[^\]]*\]\()([^)\s]+?)(#[^)\s]*)?(\))")
EXTERNAL = ("http://", "https://", "mailto:", "//")


def page_name(rel_path: str) -> str:
    """`plans/05-x/0-plan_map.md` -> `plans-05-x-0-plan_map`."""
    return rel_path[: -len(".md")].replace("/", "-")


def collect(wiki: str) -> list[str]:
    """Every publishable .md, as a wiki-relative posix path."""
    pages = []
    for root, dirs, names in os.walk(wiki):
        rel_root = os.path.relpath(root, wiki)
        if rel_root == ".":
            dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
            rel_root = ""
        for name in sorted(names):
            if name.endswith(".md"):
                pages.append(os.path.join(rel_root, name).replace(os.sep, "/"))
    return sorted(pages)


def rewrite_links(text: str, source_rel: str, pages: set[str]) -> tuple[str, list[str]]:
    """Point every internal link at its flattened page name."""
    source_dir = os.path.dirname(source_rel)
    dangling: list[str] = []

    def repl(match: re.Match[str]) -> str:
        prefix, target, anchor, suffix = match.groups()
        anchor = anchor or ""
        if target.startswith(EXTERNAL) or not target:
            return match.group(0)
        # Resolve to a wiki-relative path, tolerating a missing .md extension.
        base = target.lstrip("/") if target.startswith("/") else os.path.join(source_dir, target)
        resolved = os.path.normpath(base).replace(os.sep, "/")
        for candidate in (resolved, resolved + ".md"):
            if candidate in pages:
                return f"{prefix}{page_name(candidate)}{anchor}{suffix}"
        if resolved.endswith(".md") and not resolved.startswith(".."):
            dangling.append(f"{source_rel} -> {target}")
        return match.group(0)

    return LINK.sub(repl, text), dangling


def main() -> int:
    wiki, out = sys.argv[1], sys.argv[2]
    pages = collect(wiki)

    flat: dict[str, str] = {}
    collisions: list[str] = []
    for rel in pages:
        name = page_name(rel)
        if name in flat:
            collisions.append(f"{rel} and {flat[name]} both flatten to {name}")
        flat[name] = rel
    if collisions:
        print("ERROR: page-name collisions after flattening:", file=sys.stderr)
        for c in collisions:
            print(f"  {c}", file=sys.stderr)
        return 1

    page_set = set(pages)
    dangling: list[str] = []
    os.makedirs(out, exist_ok=True)
    for rel in pages:
        with open(os.path.join(wiki, rel), encoding="utf-8") as fh:
            text = fh.read()
        text, found = rewrite_links(text, rel, page_set)
        dangling.extend(found)
        with open(os.path.join(out, f"{page_name(rel)}.md"), "w", encoding="utf-8") as fh:
            fh.write(text)

    print(f"flattened {len(pages)} pages into {out}")
    if dangling:
        print(f"\nWARNING: {len(dangling)} link(s) to a .md that is not published:")
        for d in sorted(set(dangling)):
            print(f"  {d}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    sys.exit(main())
