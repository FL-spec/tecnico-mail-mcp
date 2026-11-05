# Logic prototype

A tiny interactive terminal app that lets the user drive a model by hand. Right when the
question is about **business logic, state transitions, or data shape** — the kind of thing
that reads fine on paper and only feels wrong once real cases run through it.

Signals this is the branch: *"I'm not sure this handles the case where X then Y."* · *"Does
this model actually let me represent…"* · *"I want to feel out what the API should look like
before writing it."* · anything where the user wants to press keys and watch state change.

If the question is what something should look like — wrong branch, use [UI.md](UI.md).

## 1. State the question
Before any code, write down the model and the question in one paragraph, **at the top of the
entry file**. A prototype that answers the wrong question is pure waste, and the written
question is what lets anyone check it later — including the user returning to it cold.

## 2. Isolate the logic in its own module
The bit answering the question goes behind a small, **pure** interface, separate from the
terminal shell that drives it.

Shape it by the question: a **pure function** `(state, action) -> state` when actions are
discrete events; an explicit **state machine** when "which actions are even legal now" is part
of the question; a **set of pure functions** over an immutable record or table when there's no
ongoing state, just transformations; a **class** when the logic genuinely owns internal state.

Keep it pure — no I/O, no terminal code, no prints for control flow. The shell imports the
module and calls in; nothing flows back the other way. That separation is what lets you read
the model as a **design** rather than as a pile of terminal plumbing — and the design is the
only part leaving this branch.

## 3. Build the smallest terminal shell that exposes the state
Redraw the whole frame on every tick (`\033[2J\033[H`), so the user sees one stable view
rather than growing scrollback. Two parts per frame, in order:

1. **Current state**, pretty-printed one field per line and diff-friendly. `\x1b[1m` bold for
   field names, `\x1b[2m` dim for derived values and timestamps, `\x1b[0m` to reset — no
   styling library unless the repo already has one.
2. **Keyboard shortcuts** along the bottom: `[a] add item  [t] tick clock  [q] quit`.

Then: initialise state as one in-memory object and render frame one; read a keystroke or line;
dispatch to a handler that mutates state; re-render the whole frame; loop until quit. **The
frame fits on one screen.**

## 4. Make it one command
One command from the worktree. Put it at the top of the file next to the question.

## 5. Hand it over
Give the user the command and let them drive. The valuable moments are *"wait, that shouldn't
be possible"* and *"huh, I assumed X would be different"* — bugs in the **idea**, which is the
entire point. New actions they ask for get added; prototypes evolve.

## 6. Capture the answer
Ask what it taught them, and hand that to `/fl-pm` with the question it answered. Running
unattended, leave it in `NOTES.md` on the branch. A model the session validates gets written
into `wiki/` and/or `specs/` via `/fl-pm` — that record is what the real implementation is
later built from, not this code, through `/fl-implement`.

## Anti-patterns
- **Tests.** A prototype that needs tests has stopped being a prototype.
- **Generalising.** No "what if we later want X". One question.
- **Blurring the module into the shell.** A model that prints or prompts can't be read as a design.
- **Treating the module as a head start.** It goes with the branch. What carries forward is the
  validated design in `wiki/` and/or `specs/`, and the real version gets written from that,
  through `/fl-implement`.
