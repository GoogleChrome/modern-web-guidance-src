# Expectations

- Skeleton styles apply to the semantic elements (`h2`, `p`, `li`, `a`, `button`, `input`) while the container has `aria-busy="true"`, without wrapper `<span>`s or per-element data attributes.
- Text bars are drawn with `border-shape: shape(...)` using rounded-end pill subpaths, with a filled `background`.
- Paragraphs render three bars of decreasing width, and headings render fewer bars than paragraphs, via multiple closed subpaths in one `shape()`.
- Skeleton text elements clip real text (`overflow: hidden`) and reserve height with `lh` units, so long content does not add lines.
- Buttons and inputs render as a single fixed-height pill with no padding or border.
- Media and avatar placeholders use a `background-color` fill with `aspect-ratio`, and are not replaced with `content: linear-gradient()`.
- Skeleton colors are derived from the surface with `color-mix()`.
- A shimmer gradient animates across each card with `background-attachment: fixed`, so the sweep is one continuous pass across all cards.
- Only a limited number of cards are visible while loading, even if more are in the markup.
