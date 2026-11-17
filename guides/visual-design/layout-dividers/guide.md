---
name: layout-dividers
description: Draw visual dividers and separator lines between rows and columns in multi-column, flex, or grid layouts without adding extra border elements or outer container borders.
web-feature-ids:
  - gap-decorations
---

# Layout dividers

Draw dividers between items of a flex, grid, or multicol container with CSS gap decorations (`column-rule`, `row-rule`, `rule`) set on the container. Rules paint centered in the gap, behind items, never change gap or container size, and stop at the container's content-box edges by default. **DO NOT** fake dividers with item `border` (changes box size, needs `:last-child` resets, breaks on wrap; use only inside an `@supports not (...)` fallback) or inject `<hr>`, `<li aria-hidden>`, `<div class="divider">`, or pseudo-elements purely as visual lines. Use `<hr>` only for semantic thematic breaks (section or topic shifts), and use `<table>` rather than grid plus rules for tabular data.

## Implementation steps

1.  **Ensure a non-zero gap.** A rule paints inside the gap; setting `gap: 0` paints nothing. Flex and grid default to `0`, so set `gap`. Multicol's default `column-gap` is already non-zero.
2.  **Declare rules on the container** with `column-rule` (inline-axis gaps), `row-rule` (block-axis gaps), or `rule` (both). Each value is `<width> <style> <color>`. Include the style: it defaults to `none`, so `1px red` paints nothing. Use `currentColor` for color, and **DO NOT** convey meaning through rule color (e.g., red means error) because rules are not in the accessibility tree.
3. If the first/last gaps or alternating gaps should differ, vary rules per gap with comma lists and `repeat()`. Comma lists assign per gap in order and cycle when shorter than the gap count; `repeat(auto, ...)` (at most one per list) fills uncovered gaps and stops cycling when the track count is unknown, and `repeat(N, ...)` requires an integer `N >= 1` or the declaration is invalid.
4.  When rules in a grid should not form a visible lattice, control intersections and segment length with `rule-break`, `rule-inset`, and `rule-overlap`. 
5.  To control whether rules are painted next to empty cells use `rule-visibility-items`.
6.  **Optional: Animate** `rule-color`, `rule-width`, or `rule-inset` (animatable; `rule-style` and `rule-break` change discretely) for hover affordances.

`column-rule` is always the inline-axis gap and `row-rule` the block-axis gap, so both flip with `writing-mode`. In a flex row, `column-rule` sits between siblings and `row-rule` between wrapped lines; in a flex column they swap.

## Choosing between options

- **`rule-break`:** `normal` (default) breaks at T-junctions and stays continuous through grid crosses; keep it for table-like grids. Use `intersection` for separated, tick-like segments. Use `none` for one unbroken line across items that span tracks (never emit `rule-break: spanning-item`).
- **`rule-inset`:** pulls segment ends back from free ends like container edges (`rule-inset-cap`) and broken intersections where rules meet (`rule-inset-junction`) with positive values, extends into padding or junctions with negative values, or sets cap then junction separately with a slash (`<length-percentage> / <length-percentage>`, or `overlap-join`); never emit `*-rule-outset`. Cap insets always apply; junction insets only take effect where rules stop or break (`intersection`, or `normal` at T-junctions and sparse corners). `overlap-join` (flush `0` at caps) makes segments meet neatly at corners and T-junctions; at full crosses it looks the same as `rule-break: normal`.
- **`rule-overlap`:** `row-over-column` (default) or `column-over-row` decides which axis paints on top at crossings; only matters when the two rules differ (never emit `gap-rule-paint-order`).
- **`rule-visibility-items`** (grid and multicol): `normal` (default), `all` (rules next to empty cells too), `around` (when either side has an item), `between` (only when both sides have items). Use `between` for sparse grids. An empty cell is one with no item placed in it: a `visibility: hidden`, `opacity: 0`, or empty placeholder element still counts as an item, so leave the cell unoccupied with `grid-template-areas` or explicit `grid-area` placement.

## Fallback strategies

{{ BASELINE_STATUS("gap-decorations") }}

In cases where dividers are purely decorative, one possibility is to not use a fallback at all: unsupported browsers render plain gaps and all content stays usable (graceful degradation).

If your use case requires visible dividers, a fallback is only robust for the simplest case, a single-column stack. Keep the gap non-zero and split it around the border so the spacing matches the rule, instead of adding padding or margin on top of the gap:

```css
.stack { display: flex; flex-direction: column; gap: 1rem; row-rule: 1px solid currentColor; }

@supports not (row-rule: 1px solid currentColor) {
  .stack { gap: 0.5rem; }
  .stack > * + * { border-block-start: 1px solid currentColor; padding-block-start: 0.5rem; }
}
```

For fixed-track grids with known or equal track sizes, a container `background` gradient can draw lines without affecting layout. Wrapping flex layouts and `auto-fill`/`auto-fit` grids have no clean CSS fallback; accept plain gaps there (do not recommend a polyfill).
