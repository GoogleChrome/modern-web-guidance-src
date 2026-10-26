# Expectations

- Skeleton styles apply to the semantic elements (`h2`, `p`, `li`, `a`, `button`, `input`) while the container has `aria-busy="true"`, without wrapper `<span>`s or per-element data attributes.
- Text bar sizes are derived from each element's own font size and line height (for example with `cap` and `lh` units), without separate bar-size overrides for headings.
- Text bars are drawn with `border-shape: shape(...)` using rounded-end bar subpaths, with a filled `background`.
- Multi-line paragraphs render 3-4 bars with the last one shorter than the rest, via multiple closed subpaths in one `shape()`. Headings render one bar.
- Skeleton text elements limit real text to the bar count with `line-clamp`, or with `overflow: hidden` and a `max-block-size` in `lh` units where `line-clamp` is unsupported, so long content does not add lines.
- Buttons, inputs, and other controls (e.g. badges) keep their own padding and `border-radius` and have no fixed block size.
- Skeleton buttons and inputs have transparent text and the skeleton tone as `background-color`.
- Media and avatar placeholders are real `<img>`/`<video>`/`<canvas>` elements, not placeholder `<div>`s, with a `background-color` fill and `aspect-ratio`. The picture is removed with a large-length `object-position` (e.g. `-9999px 0`), not `content: linear-gradient()`.
- Skeleton colors are derived from the surface with `color-mix()` using an explicit color space.
- A shimmer gradient is painted on each placeholder shape's own background with `background-attachment: fixed`, so all shapes sweep in sync without a parent overlay. The shimmer gradient and animation are only applied under `prefers-reduced-motion: no-preference`.
- Only a limited number of cards are visible while loading, even if more are in the markup.
- Under `forced-colors: active`, the skeleton opts out with `forced-color-adjust: none` and fills its placeholders with a system color.
- The skeleton container has `inert` and `aria-hidden="true"` while loading.
- The loading message is set, by script, into a `role="status"` element that was already on the page and empty when the skeleton appears.
