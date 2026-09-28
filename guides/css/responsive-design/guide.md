---
name: responsive-design
description: Build UI that adapts to container and viewport size, including container queries, dynamic viewport units, aspect ratios, and responsive typography.
web-feature-ids:
  - container-queries
  - viewport-unit-variants
  - aspect-ratio
  - min-max-clamp
  - viewport-units
---

# Responsive design

{#
This should be the entry point for anything RWD-related.
We should reference other relevant guides from here too
#}

## Overall best practices

- Use `@container` queries to create component-driven responsive layouts that adapt to their parent container's size rather than the viewport.
- Use dynamic viewport units (`dvh`, `dvw`) instead of `vh`/`vw` to prevent layout breakage when mobile browser UI elements (like address bars) appear or disappear.
- Use `aspect-ratio` for media elements (like `<img>` and `<video>`) to reserve space during loading and prevent Cumulative Layout Shift (CLS).

## Responsive typography

{{ INCLUDE("../../visual-design/typography/guide.md#responsive-typography") }}
