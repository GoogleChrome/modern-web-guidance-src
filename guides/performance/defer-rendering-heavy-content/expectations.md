# Expectations: `defer-rendering-heavy-content`

- Cards with class name `.off-screen-card` must be outside the initial viewport.
- Cards with class name `.off-screen-card` must set `content-visibility: auto`.
- Cards with class name `.off-screen-card` must set `contain-intrinsic-size`.

- The `.debug-panel` must be hidden using `content-visibility: hidden`.
- The `.debug-panel` must use a fallback strategy for unsupported browsers. The implementation must include a CSS feature detection check for native support (e.g., `@supports (content-visibility: hidden) { ... }`) and execute a fallback UI strategy for unsupported browsers.

- The `.sidebar-text` must be hidden using `hidden="until-found"`.
- The `.sidebar-text` must not have any `display` or `visibility` CSS properties applied to it directly.
- The `.sidebar-text` panels MUST NOT carry `aria-expanded` themselves — that attribute belongs only on a toggle control that actually opens/closes the panel.
- The `.sidebar-text` must use a fallback strategy for unsupported browsers. The implementation must include an explicit JavaScript feature detection check for native support (e.g., `if (!('onbeforematch' in HTMLElement.prototype))`) and execute a fallback UI strategy for unsupported browsers.
- If the implementation includes a separate toggle button (e.g. `<button aria-controls="…" aria-expanded="…">`) that reveals a `hidden="until-found"` panel, the `beforematch` event handler MUST update `aria-expanded` on that button (not on the panel).