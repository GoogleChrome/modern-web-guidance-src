# Expectations for Modern Icon Systems

The following assertions must be true for a correct implementation of the icons guide:

### Core Icon Implementation
- Icons are implemented using Inline SVG, CSS Masks, or `<img>` with CSS filters.
- External icons loaded via `mask-image` are colored using `background-color`.
- External icons loaded via `<img>` are tinted using the `filter` property.
- All SVGs include a `viewBox` attribute to ensure correct scaling.
- Icons scale crisply without pixelation using SVG as the source format.
- No "icon fonts" (e.g., FontAwesome, Material Icons font) are used.

### Accessibility
- Decorative icons (with adjacent labels) are hidden from assistive technologies using `aria-hidden="true"`.
- Meaningful icon-only buttons have an accessible name (e.g., via `aria-label` or `<title>` within a `role="img"` SVG).

### Theme & Variant Management
- Icon variants (e.g., density or state) are managed using CSS Container Style Queries (`@container style()`).
- The `--icon-variant` (or equivalent) custom property is registered using `@property` with a `<custom-ident>` syntax.
- Theme-aware icon coloring is implemented using CSS variables or `currentColor`.

### Performance
- High-resolution versions of icons are provided via `image-set()` within masks or background properties where appropriate.
