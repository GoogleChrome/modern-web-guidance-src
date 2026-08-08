# Expectations: `defer-rendering-heavy-content`

- Cards with class name `.off-screen-card` must be outside the initial viewport.
- Cards with class name `.off-screen-card` must set `content-visibility: auto`.
- Cards with class name `.off-screen-card` must set `contain-intrinsic-size`.

- The `.debug-panel` must be hidden using `content-visibility: hidden`.
- The `.debug-panel` must use a fallback strategy for unsupported browsers. The implementation must include a CSS feature detection check for native support (e.g., `@supports (content-visibility: hidden) { ... }`) and execute a fallback UI strategy for unsupported browsers.