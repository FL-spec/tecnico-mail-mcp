# Writing standards

How documentation in this repository reads, and what enforces it. `/fl-pm` binds to this file when
it writes anything into `wiki/` or `specs/`, and CI checks it on every pull request.

## The standard

Documentation here is written for a person who is trying to do something and does not yet have the
context you have.

- **Say the thing.** Lead with the claim, then support it. A paragraph that spends three sentences
  approaching its point wastes the reader's attention.
- **Prefer the concrete.** "Every issue at or under 300 changed lines including tests" beats
  "issues should be reasonably sized."
- **State the reason when the rule is surprising.** A rule without a reason gets worked around the
  first time it is inconvenient.
- **Write in the active voice**, with a subject that acts.
- **Cut hedges.** "Might potentially be somewhat useful" carries less than "helps."
- **Name the exception in place.** A caveat three sections away from the rule it qualifies gets
  missed.

## Structure: Diátaxis

Documents serve one of four purposes, and mixing two into one page serves neither. The
[Diátaxis](https://diataxis.fr/) taxonomy:

| Kind | Serves | Lives in |
|---|---|---|
| **Tutorial** | a newcomer learning by doing | `wiki/`, or the project README |
| **How-to guide** | someone with a goal and some context | `wiki/`, runbooks |
| **Reference** | someone who needs the exact contract | `specs/` |
| **Explanation** | someone who wants to understand a decision | `wiki/architecture/`, ADRs, and FDRs |

`specs/` is reference and only reference. A spec that starts explaining why is an explanation
wearing a contract's clothes, and the explanation belongs in an ADR the spec links to.

## Diagrams: Mermaid

Mermaid renders natively in GitHub, in the mirrored wiki, and in artifacts, with no build step, so
a diagram written in Mermaid is visible everywhere the documentation is read. That property
matters more than any individual feature.

- Fence with ```` ```mermaid ````.
- One idea per diagram. A diagram that needs a legend to parse has become two diagrams.
- Label the edges. An unlabelled arrow between two boxes says only that something happens.
- Keep the source readable. The text is the artifact under version control, so it gets reviewed
  like code.
- Layout gets unruly past roughly 15 nodes. Split it, or step up a level of abstraction.

Charts and data visualization are a separate problem from diagrams; see the `dataviz` skill.

## What enforces this

[Vale](https://vale.sh/) runs over `wiki/`, `specs/`, and the root documents. Two rule sets:

- **Google's developer style guide**, for voice, terminology, and structure.
- **`signs-of-ai-writing`**, built from Wikipedia's *Signs of AI Writing*, for the patterns that
  make prose read as machine-written: hedging clusters, enumeration tics, contrastive
  "not just X, it's Y" constructions, chatbot paste artifacts, and knowledge-cutoff references.

The gate runs at `--minAlertLevel=warning`, so warnings fail alongside errors. The AI-writing rules
place their most useful checks at warning and suggestion, and an error-only gate would never catch
what the rule set exists to catch.

```bash
make docs        # the gate; downloads the rule packages on first run
make docs-sync   # re-download them
```

Suggestions are advisory. Read them, act on the ones that improve the sentence, and ignore the
rest.

**Fix the sentence, never the alert.** Several Google rules ship an `action: edit` that Vale
and editor integrations apply on request, and applying one without reading it changes what
the sentence says. `Google.OxfordComma` is the one that bites: it fires on any `X and Y`
later in a sentence that already holds a comma, whether or not that `and` ends a list. Adding
its comma to "business calls become FDRs, technology and structure calls become ADRs" produces
a three-item list that means nothing. Rewrite the sentence instead, usually by splitting it.

**Three Google rules are turned off on purpose**, each recorded with a reason in `.vale.ini`:

- `Google.Headings`, because the navigation files title-case their headings deliberately.
- `Google.We`, because this repository's voice is first-person plural by design.
- `Google.Colons`, because it fires on the file-template listings, where the capitalised words
  after the colon are section names rather than sentences.

Turning off a fourth means adding it here and to the reason comment beside it in `.vale.ini`;
`make check` fails on a rule turned off in only one of the two places.

## Skill and agent files are out of scope

`.claude/`, `.agents/`, and `.codex/` are instructions written for machines. Vale's readability
rules pull against how those files need to read, so they stay outside the gate.
