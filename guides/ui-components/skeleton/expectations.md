# Expectations

- Skeleton styles apply to the semantic elements (`h2`, `p`, `li`, `a`, `button`, `input`) while the container has `aria-busy="true"`, without wrapper `<span>`s or per-element data attributes.
- Text bars are drawn with `border-shape: shape(...)` using rounded-end bar subpaths, with a filled `background`.
- Paragraphs render 3-4 bars with the last one shorter than the rest, via multiple closed subpaths in one `shape()`. Headings render one bar.
- Skeleton text elements clip real text with `line-clamp` set to the bar count (inside `@supports`), with `overflow: hidden` and `lh`-unit height reservation as the baseline, so long content does not add lines.
- Buttons, inputs, and other small surfaces that define the layout (e.g. badges) render as a single fixed-height rectangle with no visible text.
- Media and avatar placeholders are real `<img>`/`<video>`/`<canvas>` elements, not placeholder `<div>`s, with a `background-color` fill and `aspect-ratio`. The picture is removed with `content: linear-gradient(transparent, transparent)` on images, or a large-length `object-position` on video and canvas.
- Skeleton colors are derived from the surface with `color-mix()`.
- A shimmer gradient is painted on each placeholder shape's own background with `background-attachment: fixed`, so all shapes sweep in sync without a parent overlay. The shimmer gradient and animation are only applied under `prefers-reduced-motion: no-preference`.
- Only a limited number of cards are visible while loading, even if more are in the markup.
