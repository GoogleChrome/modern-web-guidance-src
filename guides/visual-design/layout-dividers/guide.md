---
name: layout-dividers
description: Draw visual dividers and separator lines between rows and columns in multi-column, flex, or grid layouts without adding extra border elements or outer container borders.
web-feature-ids:
  - gap-decorations
---

# Layout dividers

Draw dividers between items of a flex, grid, or multicol container with CSS gap decorations (`column-rule`, `row-rule`, `rule`) set on the container. Rules paint centered in the gap, behind items, never change gap or container size, and are clipped to the container's content box. This is preferred over item borders, `:last-child` resets, `<hr>`, or divider elements, which break when items wrap or reflow and add markup whose only job is to be a line.

## Implementation steps

1.  **MANDATORY: Ensure a non-zero gap.** A rule paints inside the gap. Flex and grid default to `0`, so set `gap`. Multicol's default `column-gap` is already non-zero.
2.  **MANDATORY: Declare rules on the container** with `column-rule` (inline-axis gaps), `row-rule` (block-axis gaps), or `rule` (both). Each value is `<width> <style> <color>`. Include the style: it defaults to `none`, so `1px red` paints nothing. Use `currentColor` or `light-dark()` for color.
3.  **Optional: Vary rules per gap** with comma lists and `repeat()`. Worth adding when the first/last gaps or alternating gaps should differ.
4.  **Optional: Control intersections and segment length** with `rule-break`, `rule-inset`, and `rule-overlap`. Worth adding when rules in a grid should not form a visible lattice.
5.  **Optional: Control rules next to empty cells** with `rule-visibility-items`. Worth adding for sparse grids.
6.  **Optional: Animate** `rule-color`, `rule-width`, or `rule-inset` (animatable; `rule-style` and `rule-break` change discretely) for hover affordances.

`column-rule` is always the inline-axis gap and `row-rule` the block-axis gap, so both flip with `writing-mode`. In a flex row, `column-rule` sits between siblings and `row-rule` between wrapped lines; in a flex column they swap.

## Example: Grid with per-gap rules, intersections, and hover

```css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem; /* the rule needs a gap to live in; 1rem is an example value */

  /* Comma lists assign per gap in order and cycle if shorter than the gap count.
     repeat(auto, ...) (at most one per list) fills the gaps the fixed values don't cover and stops
     cycling: use it when the track count is unknown, fixed values only for first/last gaps.
     repeat(N, ...) needs an integer N >= 1 or the whole declaration is invalid. */
  column-rule: 3px solid gray, repeat(auto, 1px dashed gray), 3px solid gray;
  row-rule: 1px solid currentColor;

  /* Break rules at every T and cross so they don't form a lattice. */
  rule-break: intersection;
  /* Pulls segment ends back from the intersection (negative extends into it); only visible when rules
     break. 0.5rem is an example value. */
  rule-inset: 0.5rem;

  transition: rule-color 0.2s; /* 0.2s is an example value */
  &:has(a:hover) { rule-color: var(--accent); }
  @media (prefers-reduced-motion: reduce) { transition: none; }
}
```

## Choosing between options

- **`rule-break`:** `normal` (default) breaks at T-junctions and stays continuous through grid crosses; keep it for table-like grids. Use `intersection` for separated, tick-like segments. Use `none` for one unbroken line across items that span tracks.
- **`rule-inset`:** only has an effect when rules break (`intersection`, or `normal` at T-junctions). `overlap-join` makes segments meet neatly at corners; with identical solid rules on both axes it looks the same as `rule-break: normal`, and only differs visually when the axes differ in color, width, or style. `rule-inset-cap` / `rule-inset-junction` target ends at the container edge versus ends meeting another gap.
- **`rule-overlap`:** `row-over-column` (default) or `column-over-row` decides which axis paints on top at crossings; only matters when the two rules differ.
- **`rule-visibility-items`** (grid and multicol): `normal` (default), `all` (rules next to empty cells too), `around` (when either side has an item), `between` (only when both sides have items). Use `between` for sparse grids. An empty cell is one with no item placed in it: a `visibility: hidden`, `opacity: 0`, or empty placeholder element still counts as an item, so leave the cell unoccupied with `grid-template-areas` or explicit `grid-area` placement.

## Key constraints

- **DO** use `column-rule` / `row-rule` / `rule` on the container for flex, grid, or multicol dividers.
- **DO NOT** fake dividers with item `border` (changes box size, needs `:last-child` resets, breaks on wrap). The only exception is inside an `@supports not (...)` block, as in the fallback below.
- **DO NOT** inject `<hr>`, `<li aria-hidden>`, or `<div class="divider">` elements or pseudo-elements.
- **DO NOT** set `gap: 0` and expect a rule to show.
- **DO NOT** use grid plus rules to present tabular data; use `<table>`.
- **DO NOT** convey meaning through rule color (e.g., red means error); rules are not in the accessibility tree.
- **MANDATORY:** use only shipped names: `*-rule-inset`, `rule-overlap`, and `rule-break: none | normal | intersection`. Never emit `*-rule-outset`, `gap-rule-paint-order`, or `rule-break: spanning-item`.

## Fallback strategies

{{ BASELINE_STATUS("gap-decorations") }}

Gap decorations are decorative, so the modern approach needs no fallback by default: unsupported browsers render plain gaps and all content stays usable (graceful degradation).

If your Baseline target requires visible dividers, a fallback is only robust for the simplest case, a single-column stack. Keep the gap non-zero and split it around the border so the spacing matches the rule, instead of adding padding or margin on top of the gap:

```css
.stack { display: flex; flex-direction: column; gap: 1rem; row-rule: 1px solid currentColor; }

@supports not (row-rule: 1px solid currentColor) {
  .stack { gap: 0.5rem; }
  .stack > * + * { border-block-start: 1px solid currentColor; padding-block-start: 0.5rem; }
}
```

Wrapping grids have no clean fallback; accept plain gaps there. A polyfill is in development, but do not recommend one.
