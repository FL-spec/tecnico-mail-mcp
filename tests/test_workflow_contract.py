"""The template's own contract tests.

These guard the parts of the workflow that rot silently: vendor adapters drifting
from the canonical roles, a skill that can no longer be invoked, a broken link, a
config that stopped matching its schema.
"""

from __future__ import annotations

import unittest
from pathlib import Path

from scripts.scan_secrets import scan_text
from scripts.validate_workflow import REPO_ROOT, ROLE_NAMES, SKILL_NAMES, validate


class WorkflowContractTests(unittest.TestCase):
    def test_repository_contract_is_valid(self) -> None:
        self.assertEqual([], validate(REPO_ROOT))

    def test_every_canonical_role_has_both_vendor_adapters(self) -> None:
        for role in ROLE_NAMES:
            with self.subTest(role=role):
                self.assertTrue((REPO_ROOT / f".agents/roles/{role}.md").is_file())
                self.assertTrue((REPO_ROOT / f".claude/agents/{role}.md").is_file())
                self.assertTrue((REPO_ROOT / f".codex/agents/{role}.toml").is_file())

    def test_every_skill_directory_has_a_skill_file(self) -> None:
        for skill in SKILL_NAMES:
            with self.subTest(skill=skill):
                self.assertTrue((REPO_ROOT / f".claude/skills/{skill}/SKILL.md").is_file())

    def test_the_router_skill_is_not_user_invocable(self) -> None:
        """fl-flow is the implicit entry point; a slash command for it would be a duplicate."""
        text = (REPO_ROOT / ".claude/skills/fl-flow/SKILL.md").read_text(encoding="utf-8")
        self.assertIn("user-invocable: false", text)

    def test_only_the_router_matches_plain_language(self) -> None:
        """Nine skills carrying their own triggers make fl-flow one candidate among ten."""
        unrouted = []
        for skill in sorted(SKILL_NAMES):
            path = REPO_ROOT / f".claude/skills/{skill}/SKILL.md"
            frontmatter = path.read_text(encoding="utf-8").split("---")[1]
            if "routed-by: fl-flow" not in frontmatter:
                unrouted.append(skill)
                continue
            with self.subTest(skill=skill):
                self.assertIn(
                    f"/{skill}",
                    frontmatter,
                    f"{skill} must name its own slash command in its description",
                )
                self.assertNotIn(
                    "Use when the user",
                    frontmatter,
                    f"{skill} must not carry plain-language triggers — those belong to fl-flow",
                )
        self.assertEqual(["fl-flow"], unrouted, "exactly one skill may match plain language")

    def test_no_gated_document_mandates_clearing_context(self) -> None:
        """/clear is a command the developer types to discard what the router needs."""
        documents = [REPO_ROOT / name for name in ("CLAUDE.md", "README.md", "HOW_WE_BUILD.md")]
        documents += sorted((REPO_ROOT / ".claude/skills").rglob("*.md"))
        for path in documents:
            with self.subTest(document=path.name):
                self.assertNotIn(
                    "/clear",
                    path.read_text(encoding="utf-8"),
                    f"{path.relative_to(REPO_ROOT)} still instructs the developer to /clear",
                )

    def test_guardrails_hook_is_executable_and_blocks_force_push(self) -> None:
        import json
        import subprocess

        hook = REPO_ROOT / ".claude/hooks/git-guardrails.sh"
        payload = json.dumps({"tool_input": {"command": "git push --force origin main"}})
        blocked = subprocess.run(
            ["bash", str(hook)], input=payload, capture_output=True, text=True
        )
        self.assertEqual(2, blocked.returncode, "force-push must be blocked with exit 2")

        payload = json.dumps({"tool_input": {"command": "git status"}})
        allowed = subprocess.run(
            ["bash", str(hook)], input=payload, capture_output=True, text=True
        )
        self.assertEqual(0, allowed.returncode, "a harmless command must be allowed")

    def test_wiki_flattens_without_page_name_collisions(self) -> None:
        """A GitHub wiki has no directories, so two files sharing a basename collide."""
        import subprocess
        import tempfile

        with tempfile.TemporaryDirectory() as out:
            result = subprocess.run(
                ["python3", ".github/scripts/flatten_wiki.py", "wiki", f"{out}/flat"],
                cwd=REPO_ROOT,
                capture_output=True,
                text=True,
            )
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertTrue(Path(f"{out}/flat/Home.md").is_file())

    def test_secret_scanner_detects_key_shapes(self) -> None:
        value = "OPENAI_API_KEY=" + "sk-" + ("a" * 32)
        self.assertEqual([(1, "OpenAI API key")], scan_text(value))

    def test_secret_scanner_allows_placeholders(self) -> None:
        self.assertEqual([], scan_text("OPENAI_API_KEY=\nTOKEN=<placeholder>"))

    def test_every_user_invocable_skill_is_reachable_from_the_walkthrough(self) -> None:
        """A skill nobody is told about is a skill nobody runs."""
        how_we_build = (REPO_ROOT / "HOW_WE_BUILD.md").read_text(encoding="utf-8")
        for skill in sorted(SKILL_NAMES):
            text = (REPO_ROOT / f".claude/skills/{skill}/SKILL.md").read_text(encoding="utf-8")
            if "user-invocable: false" in text:
                continue
            with self.subTest(skill=skill):
                self.assertIn(f"/{skill}", how_we_build)


class DesignSkillContractTests(unittest.TestCase):
    """fl-design is the only skill that owns a file in specs/, and it splits a boundary
    with fl-prototype's UI branch. Both bindings are prose, so both rot silently."""

    def setUp(self) -> None:
        self.skill = (REPO_ROOT / ".claude/skills/fl-design/SKILL.md").read_text(encoding="utf-8")
        self.ui = (REPO_ROOT / ".claude/skills/fl-prototype/UI.md").read_text(encoding="utf-8")

    def test_fl_design_is_user_invocable(self) -> None:
        """Unlike fl-flow, this one is reached by name."""
        self.assertNotIn("user-invocable: false", self.skill)

    def test_fl_design_owns_the_design_token_contract(self) -> None:
        self.assertIn("specs/design-tokens.md", self.skill)

    def test_design_token_invariants_carry_a_testable_prefix(self) -> None:
        """Invariants in specs/ are prefixed and testable; the token spec is no exception."""
        self.assertIn("DES-INV-", self.skill)

    def test_fl_design_hands_exploration_back_to_the_prototype_ui_branch(self) -> None:
        self.assertIn("fl-prototype", self.skill)
        self.assertIn("UI.md", self.skill)

    def test_the_prototype_ui_branch_hands_the_winner_forward_to_fl_design(self) -> None:
        """The link is relative on purpose: validate_workflow.py resolves it on disk,
        so renaming either skill directory breaks `make check` rather than a reader."""
        self.assertIn("(../fl-design/SKILL.md)", self.ui)

    def test_the_two_skills_agree_on_where_the_tokens_live(self) -> None:
        self.assertIn("specs/design-tokens.md", self.ui)

    def test_the_verification_loop_ends_in_a_rendered_surface(self) -> None:
        """Design's whole claim is that someone looked. Keep the checklist honest."""
        for requirement in ("375px", "dark mode", "prefers-reduced-motion", "WCAG AA"):
            with self.subTest(requirement=requirement):
                self.assertIn(requirement, self.skill)


class ProseGateContractTests(unittest.TestCase):
    """The prose gate is declared in four places — .vale.ini, the Makefile, the CI job,
    and writing-standards.md. Nothing but this test keeps them saying the same thing."""

    @staticmethod
    def _vale_config() -> "configparser.ConfigParser":
        import configparser

        # Vale's ini opens with keys before any section header; give them one.
        text = (REPO_ROOT / ".vale.ini").read_text(encoding="utf-8")
        parser = configparser.ConfigParser()
        parser.read_string("[vale]\n" + text)
        return parser

    @staticmethod
    def _excluded_directories(text: str, pattern: str) -> set[str]:
        import re

        match = re.search(pattern, text)
        assert match, f"pattern not found: {pattern}"
        # The Makefile separates with "|" (a grep alternation), the CI glob with ",".
        parts = re.split(r"[,|]", match.group(1))
        return {part.strip().replace("\\", "") for part in parts}

    def setUp(self) -> None:
        self.config = self._vale_config()
        self.makefile = (REPO_ROOT / "Makefile").read_text(encoding="utf-8")
        self.ci = (REPO_ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8")
        self.policy = (REPO_ROOT / ".sdlc/policies/writing-standards.md").read_text(
            encoding="utf-8"
        )

    def test_both_rule_sets_are_enabled_for_markdown(self) -> None:
        styles = self.config["*.md"]["basedonstyles"]
        self.assertIn("Google", styles)
        self.assertIn("signs-of-ai-writing", styles)

    def test_every_disabled_rule_is_documented_in_the_writing_standard(self) -> None:
        """Turning a rule off is a style decision, and a style decision belongs in the
        policy a writer reads — not only in a config comment they never open."""
        for key, value in self.config["*.md"].items():
            if value.strip().upper() != "NO":
                continue
            with self.subTest(rule=key):
                self.assertIn(key.split(".")[-1].lower(), self.policy.lower())

    def test_every_disabled_rule_carries_its_reason_in_the_config(self) -> None:
        """A rule switched off without a reason gets read as noise-suppression and
        switched back on by the next person."""
        import re

        lines = (REPO_ROOT / ".vale.ini").read_text(encoding="utf-8").splitlines()
        for index, line in enumerate(lines):
            if not re.match(r"^\s*\S+\.\S+\s*=\s*NO\s*$", line):
                continue
            preceding = [item.strip() for item in lines[max(0, index - 4) : index]]
            with self.subTest(rule=line.strip()):
                self.assertTrue(
                    any(item.startswith("#") and len(item) > 2 for item in preceding),
                    f"{line.strip()} has no comment explaining why",
                )

    def test_the_declared_vocabulary_is_committed(self) -> None:
        """`vale sync` restores the packages but never the vocabulary, so a missing
        accept.txt means a fresh clone gets different results from this one."""
        vocab = self.config["vale"]["vocab"]
        accept = REPO_ROOT / ".vale/styles/config/vocabularies" / vocab / "accept.txt"
        self.assertTrue(accept.is_file(), f"missing {accept.relative_to(REPO_ROOT)}")

    def test_the_package_cache_is_ignored_rather_than_committed(self) -> None:
        """Downloaded rule packages are build output. `make docs-sync` restores them.

        The probe is a path *inside* each package directory, not the directory itself:
        the ignore patterns end in a slash, and `git check-ignore` decides whether a
        path is a directory by looking at the filesystem. On a fresh clone, where the
        cache has not been downloaded yet, asking about the bare directory reports it
        as unignored — which would make this test pass only on a machine that already
        ran `make docs-sync`.
        """
        import subprocess

        styles = Path(self.config["vale"]["stylespath"])
        for package in self.config["vale"]["packages"].split(","):
            name = package.strip().rsplit("/", 1)[-1].removesuffix(".zip")
            probe = styles / name / "Rule.yml"
            with self.subTest(package=name):
                ignored = subprocess.run(
                    ["git", "check-ignore", "-q", str(probe)], cwd=REPO_ROOT
                )
                self.assertEqual(0, ignored.returncode, f"{name} is not gitignored")

    def test_the_gate_fails_on_warnings_everywhere_it_is_declared(self) -> None:
        """The signs-of-ai-writing rules put their most useful checks at warning level,
        so an error-only gate anywhere is a gate that catches nothing."""
        level = "--minAlertLevel=warning"
        self.assertIn(level, self.makefile)
        self.assertIn(level, self.ci)
        self.assertIn(level, self.policy)

    def test_ci_gates_on_the_makefile_target_rather_than_on_reviewdog(self) -> None:
        """reviewdog gates at `-fail-level=error` and cannot be told to fail on a
        warning, so a job that ends at the annotation step reports warnings and still
        goes green. `make docs` has to be the step that decides."""
        import re

        gate = re.search(r"^\s*run: make docs\s*$", self.ci, re.MULTILINE)
        self.assertIsNotNone(gate, "no `run: make docs` step — `make docs-sync` is not the gate")
        self.assertIn("fail_on_error: false", self.ci)

    def test_ci_and_the_makefile_gate_the_same_files(self) -> None:
        """CI linting a directory `make docs` skips is how a branch goes green locally
        and red on GitHub — and .claude/ does not merely add noise, its frontmatter
        stops Vale with a parse error."""
        local = self._excluded_directories(self.makefile, r"grep -vE '\^\(([^)]*)\)/'")
        remote = self._excluded_directories(self.ci, r"--glob=!\{([^}]*)\}")
        self.assertEqual({".claude", ".agents", ".codex", ".github"}, local)
        self.assertEqual(local, remote)

    def test_the_policy_names_the_directories_it_puts_out_of_scope(self) -> None:
        for directory in (".claude/", ".agents/", ".codex/"):
            with self.subTest(directory=directory):
                self.assertIn(directory, self.policy)

    def test_the_gate_downloads_its_own_rule_packages(self) -> None:
        """`make docs` on a fresh clone has to work. Without the package cache as a
        prerequisite it dies with "style 'Google' does not exist on StylesPath", which
        a first-time reader hits before the README has told them about `make docs-sync`.

        The cache path is asserted against .vale.ini rather than hardcoded, so renaming
        StylesPath or dropping a package from Packages fails here instead of failing on
        somebody's first clone.
        """
        import re

        declared = re.search(
            r"^VALE_PACKAGE_CACHE\s*=\s*(\S+)", self.makefile, re.MULTILINE
        )
        self.assertIsNotNone(declared, "Makefile declares no VALE_PACKAGE_CACHE")
        cache = declared.group(1)

        styles = self.config["vale"]["stylespath"].rstrip("/")
        packages = {
            item.strip().rsplit("/", 1)[-1].removesuffix(".zip")
            for item in self.config["vale"]["packages"].split(",")
        }
        self.assertTrue(cache.startswith(f"{styles}/"), f"{cache} is not under {styles}")
        self.assertIn(cache[len(styles) + 1 :], packages)

        for target in ("docs", "docs-suggestions"):
            with self.subTest(target=target):
                self.assertRegex(
                    self.makefile,
                    rf"(?m)^{target}: \| \$\(VALE_PACKAGE_CACHE\)$",
                )

    def test_every_stack_preset_ignores_what_it_builds(self) -> None:
        """ci.yml ships a preset per stack. A preset whose artifacts aren't ignored
        leaves `git status` dirty the first time somebody runs the gates it turns on."""
        gitignore = (REPO_ROOT / ".gitignore").read_text(encoding="utf-8")
        for command, artifact in (
            ("pnpm install", "node_modules/"),
            ("uv sync", ".venv/"),
            ("cargo build", "target/"),
        ):
            if command not in self.ci:
                continue
            with self.subTest(preset=command):
                self.assertIn(artifact, gitignore)


class VersionContractTests(unittest.TestCase):
    """The README states the template's version twice — a header badge and a footer line.

    v2.1.0 shipped with `v2.1` inserted *above* the old `v2.0` badge rather than replacing
    it, and with the footer still reading v2.0. Neither gate noticed: Vale checks prose
    style and validate_workflow.py checks links and file existence, so a README claiming
    two versions at once is invisible to both. This class is the gate that would have.
    """

    import re as _re

    VERSION = _re.compile(r"\bv\d+\.\d+(?:\.\d+)?\b")
    README = REPO_ROOT / "README.md"

    HISTORY_HEADING = "## Upgrading from v1"

    def _outside_the_history_section(self) -> str:
        """A version-history section names superseded versions on purpose.

        The README carries none today; the exclusion stays so that reinstating one doesn't
        fail this class. Such a section runs to the next horizontal rule, and table
        delimiters (`| --- |`) are not bare rules, so they don't end it early.
        """
        text = self.README.read_text(encoding="utf-8")
        if self.HISTORY_HEADING not in text:
            return text
        start = text.index(self.HISTORY_HEADING)
        end = text.index("\n---\n", start)
        return text[:start] + text[end:]

    def _current_version(self) -> str:
        found = set(self.VERSION.findall(self._outside_the_history_section()))
        self.assertEqual(
            1, len(found), f"README names {sorted(found)}; outside its history it must name one"
        )
        return found.pop()

    def test_the_readme_names_exactly_one_version(self) -> None:
        self._current_version()

    def test_the_header_badge_is_not_a_stack_of_versions(self) -> None:
        """The exact shape of the bug: a new badge added without deleting the old one."""
        text = self.README.read_text(encoding="utf-8")
        header = text[: text.index("</div>")]
        badges = self.VERSION.findall(header)
        self.assertEqual(1, len(badges), f"header badge block names {badges}")

    def test_the_footer_matches_the_badge(self) -> None:
        text = self.README.read_text(encoding="utf-8")
        footer = text[text.rindex("<sub>") :]
        self.assertIn(self._current_version(), footer)

    def test_no_gated_document_names_a_superseded_version(self) -> None:
        """Any document the prose gate covers has to agree with the README."""
        import subprocess

        current = self._current_version()
        listed = subprocess.run(
            ["git", "ls-files", "*.md"], cwd=REPO_ROOT, capture_output=True, text=True
        ).stdout.split()
        for name in listed:
            if name.startswith((".claude/", ".agents/", ".codex/", ".github/")):
                continue
            # The changelog is the version history, so it names every release on purpose.
            if name == "CHANGELOG.md":
                continue
            text = (REPO_ROOT / name).read_text(encoding="utf-8")
            if name == "README.md":
                text = self._outside_the_history_section()
            with self.subTest(document=name):
                self.assertEqual(
                    set(), set(self.VERSION.findall(text)) - {current},
                    f"{name} names a version other than {current}",
                )


if __name__ == "__main__":
    unittest.main()
