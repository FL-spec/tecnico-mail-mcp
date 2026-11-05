# Template contract gates. These check the workflow itself, not your project code.
# Your project's gates live under `quality_gates` in .sdlc/sdlc-config.yml and run
# through the fl-* skills.

PYTHON ?= python3
VALE ?= vale

# The prose gate runs at warning level on purpose: the signs-of-ai-writing rules put
# their most useful checks at warning and suggestion, so an error-only gate would
# never catch what they exist to catch. See .sdlc/policies/writing-standards.md.
DOC_SOURCES = $(shell git ls-files '*.md' | grep -vE '^(\.claude|\.agents|\.codex|\.github)/')

.PHONY: test validate security docs docs-sync docs-suggestions check install-dev

install-dev:
	@$(PYTHON) -m pip install -r requirements-dev.txt

# `vale sync` downloads the packages named in .vale.ini into StylesPath. Treating the
# first of them as a build artifact is what lets `make docs` work on a fresh clone: a
# reader who runs the gate before reading the README gets the packages rather than
# "style 'Google' does not exist on StylesPath". Adding a package to .vale.ini means
# running `make docs-sync` by hand, because this directory already exists by then.
VALE_PACKAGE_CACHE = .vale/styles/Google

$(VALE_PACKAGE_CACHE):
	@$(VALE) sync

# Re-download the Vale rule packages named in .vale.ini.
docs-sync:
	@$(VALE) sync

# The prose gate. Fails on errors and warnings.
docs: | $(VALE_PACKAGE_CACHE)
	@$(VALE) --minAlertLevel=warning $(DOC_SOURCES)

# Advisory: everything the gate lets through. Read it, act on what improves a sentence.
docs-suggestions: | $(VALE_PACKAGE_CACHE)
	@$(VALE) --no-exit --minAlertLevel=suggestion $(DOC_SOURCES)

test:
	@$(PYTHON) -m unittest discover -s tests -p "test_*.py"

validate:
	@$(PYTHON) scripts/validate_workflow.py

security:
	@$(PYTHON) scripts/scan_secrets.py

check: validate security test
