# Security policy

## Supported versions

Only the latest release receives fixes. Projects created from the template own their copy and
pull changes in by hand.

| Version | Supported |
| --- | --- |
| 2.1.x | Yes |
| < 2.1 | No |

## Report a vulnerability

Report it privately through
[GitHub private vulnerability reporting](https://github.com/FL-spec/Setup/security/advisories/new).
Don't open a public issue for it.

Include the file or workflow involved, the steps that reproduce it, and what an attacker gains.
Expect an acknowledgement within seven days.

## What's in scope

- The CI workflows in `.github/workflows/`, including the wiki mirror.
- The guardrail hook in `.claude/hooks/git-guardrails.sh` and the secret scan in
  `scripts/scan_secrets.py`.
- Skill or role instructions that would lead an agent to leak secrets, push to a protected
  branch, or merge without review.

Your own project's code, once created from the template, is out of scope here.
