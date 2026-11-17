---
name: layout-dividers
description: Draw visual dividers and separator lines between rows and columns in multi-column, flex, or grid layouts without adding extra border elements or outer container borders.
web-feature-ids:
  - gap-decorations
---

# Layout dividers

Choose a divider technique by what the line means and how the layout behaves, not by which feature is newest.

## Which divider technique to use?

Walk top to bottom and stop at the first match.

1. **The line marks a thematic or topic break in content** (a section or subject shift): use `<hr>`. It exposes `role="separator"` to assistive technology. CSS rules are not in the accessibility tree, so never replace a semantic break with them.
2. **The content is tabular data:** use `<table>` with cell or row borders. Do not fake a table with grid plus rules.
3. **Items sit flush with no gap (`gap: 0`):** in a simple non-wrapping stack, use an adjacent-sibling border (`> * + * { border-block-start: 1px solid currentColor; }`). In a grid of opaque cells, `gap: 1px` over a contrasting container background draws the lines without touching the items.
4. **The content flows in columns (multicol):** use `column-rule` on the multicol container.
5. **Items are spaced, responsive, or wrapping in flex or grid:** use CSS gap decorations (`column-rule`, `row-rule`, `rule`) on the container. Rules paint centered in the gap, behind items, never change gap or container size, and stop at the container's content-box edges by default. They survive wrapping and reflow without `:last-child` or `:nth-child` resets.

**DO NOT** inject `<li aria-hidden>`, `<div class="divider">`, or pseudo-elements purely as visual lines, and **DO NOT** put borders on items of a spaced or wrapping flex or grid layout (changes box size, needs `:last-child` resets, breaks on wrap) outside an `@supports not (...)` fallback.

The rest of this guide covers options 4 and 5.

## Implementation steps

1.  **Ensure a non-zero gap.** A rule paints inside the gap; setting `gap: 0` paints nothing. Flex and grid default to `0`, so set `gap`. Multicol's default `column-gap` is already non-zero.
2.  **Declare rules on the container** with `column-rule` (inline-axis gaps), `row-rule` (block-axis gaps), or `rule` (both). Each value is `<width> <style> <color>`. Include the style: it defaults to `none`, so `1px red` paints nothing. Use `currentColor` for color, and **DO NOT** convey meaning through rule color (e.g., red means error) because rules are not in the accessibility tree.
3. If the first/last gaps or alternating gaps should differ, vary rules per gap with comma lists and `repeat()`. Comma lists assign per gap in order and cycle when shorter than the gap count; `repeat(auto, ...)` (at most one per list) fills uncovered gaps and stops cycling when the track count is unknown, and `repeat(N, ...)` requires an integer `N >= 1` or the declaration is invalid.
4.  When rules in a grid should not form a visible lattice, control intersections and segment length with `rule-break`, `rule-inset`, and `rule-overlap`. 
5.  To control whether rules are painted next to empty cells use `rule-visibility-items`.
6.  **Optional: Animate** `rule-color`, `rule-width`, or `rule-inset` (animatable; `rule-style` and `rule-break` change discretely) for hover affordances.

`column-rule` is always the inline-axis gap and `row-rule` the block-axis gap, so both flip with `writing-mode`. In a flex row, `column-rule` sits between siblings and `row-rule` between wrapped lines; in a flex column they swap.

## Choosing between options

Pick each property for the design goal it serves; leave it at its default when none applies.

- **Related cells that read as one structure (ledgers, bento grids, table-like layouts):** keep `rule-break: normal` so lines run continuous through crossings.
- **Separate tiles or cards that read as independent units:** use `rule-break: intersection` so rules stop at crossings instead of forming a lattice. Pair it with a junction inset (`rule-inset-junction`) when the segments should not touch.
- **A featured item spanning several tracks:** use `rule-break: none` when the rule should run unbroken behind spanning items.
- **Edge alignment (the default):** keep insets at `0` so rules start and end flush with the content edges.
- **Full-bleed dividers inside a padded container:** use a negative cap inset equal to the padding (e.g., `row-rule-inset: -1rem` for `padding: 1rem`) so rules reach the container edge without extra wrapper elements. Do not clip the container's overflow.
- **Neat corners where segments meet:** use `rule-inset: overlap-join` (flush `0` at free ends, extends into junctions). It only differs from `normal` at T-junctions and corners, such as those `rule-visibility-items: between` leaves in sparse grids.
- **Cap versus junction insets:** `rule-inset-cap` affects free ends such as container edges and always applies. `rule-inset-junction` only takes effect where rules stop or break (`intersection`, or `normal` at T-junctions and sparse corners). `rule-inset: <cap> / <junction>` sets both; use `rule-inset-junction` alone to leave outer ends flush. Never emit `*-rule-outset` or `rule-break: spanning-item`.
- **Visual hierarchy (heavier outer or header rules, subtle interior rules):** vary rules per gap with comma lists (step 3). When the two axes differ, `rule-overlap` decides which paints on top at crossings: `row-over-column` (default) or `column-over-row`. Never emit `gap-rule-paint-order`.
- **Sparse grids or a partially filled last row:** use `rule-visibility-items: between` (grid and multicol) so no rules dangle toward empty cells. `all` paints rules next to empty cells too, `around` when either side has an item, `normal` is the default. An empty cell is one with no item placed in it: a `visibility: hidden`, `opacity: 0`, or empty placeholder element still counts as an item, so leave the cell unoccupied with `grid-template-areas` or explicit `grid-area` placement.
- **Animation:** `rule-inset` can animate rules drawing in or out; `rule-color` and `rule-width` can animate emphasis. Gate transitions behind `@media (prefers-reduced-motion: no-preference)` and read the antipatterns below first.

## Visual and UX antipatterns

- **DO NOT** use small arbitrary insets (e.g., `0.5rem`) on edge rules. Rules that fall slightly short of the content edges break alignment without reading as a deliberate centered divider. Use `0`, a negative inset for full-bleed, or `overlap-join`.
- **DO NOT** build dense grids from thick, high-contrast rules with narrow gaps. Four-way crossings can trigger the Hermann grid illusion (ghost gray spots at intersections), and broken intersections with small junction insets leave distracting white gaps. Prefer thin, low-contrast rules, wider gaps, or rules in one axis only.
- **DO NOT** change `rule-color` or `rule-width` for the whole container when a child is hovered or focused. Item hover and focus styling already shows interaction state; restyling every rule pulls attention away from the active item and forces the user to re-scan the structure to find it. The exception is a grid whose rules are hidden or barely visible at rest, where revealing them on interaction does not compete with the active item. Scope any such transition to `@media (prefers-reduced-motion: no-preference)`.

## Fallback strategies

{{ BASELINE_STATUS("gap-decorations") }}

Fallbacks reuse the techniques from the decision tree above. In cases where dividers are purely decorative, one possibility is to not use a fallback at all: unsupported browsers render plain gaps and all content stays usable (graceful degradation).

If your use case requires visible dividers, a fallback is only robust for the simplest case, a single-column stack, where the adjacent-sibling border from option 3 applies. Keep the gap non-zero and split it around the border so the spacing matches the rule, instead of adding padding or margin on top of the gap:

```css
.stack { display: flex; flex-direction: column; gap: 1rem; row-rule: 1px solid currentColor; }

@supports not (row-rule: 1px solid currentColor) {
  .stack { gap: 0.5rem; }
  .stack > * + * { border-block-start: 1px solid currentColor; padding-block-start: 0.5rem; }
}
```

For fixed-track grids with known or equal track sizes, a container `background` gradient can draw lines without affecting layout. Wrapping flex layouts and `auto-fill`/`auto-fit` grids have no clean CSS fallback; accept plain gaps there (do not recommend a polyfill).
