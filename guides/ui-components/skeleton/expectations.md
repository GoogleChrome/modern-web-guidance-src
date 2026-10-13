# Expectations

- The loading container has `aria-busy="true"` scoped by a container selector (e.g., `.skeleton`).
- While loading, the container element has the `inert` attribute applied to prevent user interaction.
- The loading state is applied to the semantic content without replacing them with placeholder-only elements.
- Text content within headings, paragraphs, and links is wrapped in inline `<span>` elements.
- During loading, text elements have transparent text color (`color: transparent`).
- During loading, link text decoration is removed (`text-decoration: none`).
- Inline text `<span>` elements use `box-decoration-break: clone` (and `-webkit-box-decoration-break: clone`) with a background color to paint separate rounded bars across wrapped lines.
- Replaced media elements (images, SVGs, or videos) are visually hidden during loading while their container layout is preserved.
- Media elements or their containers reserve layout space using `aspect-ratio` or explicit dimensions to prevent layout shifts.
- Text containers reserve vertical layout space using `min-block-size` with `lh` units.
- Block placeholder elements (media containers, avatars, or controls) apply a gradient shimmer animation.
- Shimmer position and pulse color are registered custom properties defined via `@property`.
- The pulse animation is applied to the loading container and inherited by inline text spans through a custom property.
- Under `@media (prefers-reduced-motion: reduce)`, shimmer and pulse animations are disabled while placeholders remain visible.
- Skeleton placeholder colors adapt to light and dark color schemes using `light-dark()`.
- Media containers use CSS masks and `mask-composite` to render a decorative placeholder icon cutout.
- Toggling the loading state off removes `aria-busy="true"` and `inert`, restoring content visibility and interactivity.
