---
name: masonry-layout
description: Pack items of varying heights into tightly stacked columns so shorter items rise to fill the vertical gaps left by taller neighbors, avoiding the ragged bottom edge of a standard grid.
draft: stub
web-feature-ids:
  - grid-lanes
---

# Masonry Layout

## Implementation notes for guide authors

- Migrate and expand the masonry guidance from `guides/css/css-layout/guide.md` (`## 8 Grid lanes (aka masonry)`) into this dedicated guide, and replace that section in `css-layout` with a pointer to `{{ GUIDE_REF("masonry-layout") }}`.
- Cover `display: grid-lanes` (and `@supports` progressive enhancement) alongside fallback strategies (`columns` with `break-inside: avoid` for document fragments vs. `grid-auto-flow: dense` for non-interactive grids, noting DOM/tab-order constraints).
