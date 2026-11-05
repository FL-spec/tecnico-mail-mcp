---
name: fl-design
description: >
  Design and build a user-facing surface that looks deliberate rather than generated, then
  verify it by looking at it. Owns the design-token contract in specs/. Invoked by fl-flow, or
  when the user types /fl-design.
routed-by: fl-flow
---

# Design

Two failure modes, and they need different answers.

**The surface looks generated.** Default fonts, a palette assembled from nothing, evenly spaced
cards, motion sprinkled on individual elements. Models converge on the same choices because those
choices are the average of everything they read. The fix is deliberate constraint, applied before
any markup exists.

**The surface was never looked at.** Nobody rendered it. Nobody checked it at 375px, in dark mode,
with real data and a name long enough to wrap. The fix is a verification loop that ends in an
actual screenshot.

This skill covers both, and it binds the result to a token contract so the next slice inherits the
decisions instead of re-inventing them.

## 1 · Read the constraints before designing anything

In order:

1. **`specs/design-tokens.md`**, if it exists. That is the contract: palette, type scale, spacing,
   radius, motion durations. **Match it exactly.** A slice that invents a ninth grey has broken the
   design system as surely as a slice that invents a ninth API field has broken the API.
2. The existing UI code. Follow its component patterns rather than introducing a second way to
   build a button.
3. `wiki/CONTEXT.md` for what things are called on screen.
4. The relevant `wiki/prd/<module>.md` for what the surface is for.

No token file and no existing UI means this is the first surface. Go to step 2 and **write the
token file as part of the work.**

## 2 · Choose deliberately

The guidance below is adapted from Anthropic's `frontend-design` skill, which exists because
models drift toward the statistical middle of design. Install the upstream skill alongside this
one if you want its full text: `anthropics/skills`, or the `frontend-design` plugin in
`anthropics/claude-code`.

**Typography.** Pick a typeface that carries a point of view, and pair it with intent. Inter,
Roboto, Arial and system-ui are the defaults every generated page reaches for, so reaching for
them is a decision to look like every generated page. Set a real scale, not arbitrary sizes, and
let the display size be genuinely large. One expressive face plus one workhorse beats four
tasteful ones.

**Color.** Commit to a dominant colour and cut it with a sharp accent, rather than distributing
five hues evenly. Define every value as a CSS custom property so the theme is one contract and not
a hundred literals. Draw the palette from something real: a material, a place, a print tradition,
the product's own domain.

**Depth.** Flat white behind everything reads as unfinished. Gradients, layered translucency,
noise, a subtle pattern, or one considered texture give a page somewhere to sit.

**Motion.** One coherent idea carried through, done in CSS, respecting
`prefers-reduced-motion`. A staggered reveal on load beats nine unrelated hover effects.

**Density and rhythm.** Vary it. Uniform card grids at uniform spacing are what "assembled" looks
like. Let the important thing be bigger.

Prompt at the right altitude: "a warm editorial palette anchored on oxblood" is a design decision;
`#7B1E22` is a constraint that stops one. Neither "make it pretty" nor a full hex specification
gets you a designed page.

## 3 · Write the tokens down

Every decision from step 2 lands in **`specs/design-tokens.md`**, in the seven-section spec
skeleton like any other contract:

- **§2 External surface** — the token names and values as CSS custom properties, the type scale,
  the spacing scale, radii, shadows, motion durations and easings, and the breakpoints.
- **§4 Invariants** — testable, prefixed `DES-INV-n`. For example: *every colour used in the UI
  resolves to a token*; *text on any surface token meets WCAG AA*; *no component defines a
  duration outside the motion scale*.
- **§7 Current State** — where the code diverges from the contract today.

This is what makes design durable here. The palette in someone's head dies with the session; the
palette in `specs/` is what the next `slice-implementer` reads.

## 4 · Look at it

**A UI slice is not done until someone has rendered it and looked.** Not the markup. The pixels.

Take the surface up on whatever the project already uses (`/run`, its dev server, the browser
tools, the iOS simulator), then check, at minimum:

- **Narrow and wide.** 375px and desktop. Wide content scrolls inside its own container; the page
  body never scrolls sideways.
- **Both themes**, if the project has them, including the system-default case where neither theme
  class is set.
- **Real data.** The longest plausible name, the empty state, the error state, the loading state,
  fifty rows rather than three.
- **Contrast**, against the AA threshold, for body text and for anything interactive.
- **Keyboard**: focus is always visible and the tab order follows the visual order.
- **Reduced motion**: the page is still usable and still makes sense.

Report what you saw, and attach the screenshots. "It should work" is not a verification, and
neither is a passing test suite. A screenshot is evidence in the sense
`.agents/roles/integration-verifier.md` means it.

## 5 · Hand off

Say which tokens you added or changed, what you rendered, what you found when you looked, and what
you deliberately left. A design decision worth keeping goes to `/fl-pm` for `specs/design-tokens.md`
and, if it settles a real trade-off, an ADR.

## Boundaries

- **Exploring several directions is `/fl-prototype`'s job** (its `UI.md` branch), not this one.
  Come here once a direction is chosen, or when there is only one surface to build.
- **Charts and data visualization are a different problem.** Anthropic's `dataviz` skill covers
  palette construction for series, stat tiles, and dashboard layout; use it for those and keep the
  tokens consistent between them.
- **Diagrams are Mermaid**, per `.sdlc/policies/wiki-conventions.md`. Not this skill's business.
- The token contract is real. Changing a token changes a published contract, so it updates
  `specs/design-tokens.md` in the same PR, exactly like any other spec.
