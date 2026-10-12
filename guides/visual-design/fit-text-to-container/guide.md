---
name: fit-text-to-container
description: Make text always fit its container's width, e.g. a card headline that fills the full width on one line at any size, or a long title that fits instead of overflowing or wrapping
draft: stub
web-feature-ids:
  - text-fit
---

# Fit text to container width

## Notes for guide authors

- Core guidance: `text-fit: grow` to fill the width, `text-fit: shrink` to prevent overflow. Shrinking single-line text needs `white-space: nowrap` (or `text-wrap: nowrap`), otherwise the browser wraps before it shrinks.
- Always set guardrails via percentages
- Caveat: computed `font-size` doesn't change, so `em`-based padding, margins, and borders don't scale with it. Percentage `letter-spacing`/`word-spacing` do. Unitless `line-height` works as expected as well.
- The container needs a definite inline size. `text-fit` doesn't affect intrinsic sizing, so it does nothing on `width: fit-content`, inline elements, or shrink-wrapped flex/grid items.
- I suspect most use cases will also need the `consistent` keyword

## Relationship to other guides

- `typography` lists `text-fit` in `todo-web-feature-ids`; once this is written, add a one-liner there and reference this guide.
- Cross-link with `equal-width-text-lines`
- `fluid-scaling`: could be useful as a fallback if fitting is not essential
