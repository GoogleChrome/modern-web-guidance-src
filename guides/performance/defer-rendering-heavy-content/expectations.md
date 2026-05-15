# Expectations: `defer-rendering-heavy-content`

- Cards with class name `.off-screen-card` must be outside the initial viewport.
- Cards with class name `.off-screen-card` must set `content-visibility: auto`.
- Cards with class name `.off-screen-card` must set `contain-intrinsic-size`.

- The `.debug-panel` must be hidden using `content-visibility: hidden`.
- The `.debug-panel` must use a fallback strategy for unsupported browsers. The implementation must include a CSS feature detection check for native support (e.g., `@supports (content-visibility: hidden) { ... }`) and execute a fallback UI strategy for unsupported browsers.

- The `.sidebar-text` must be hidden using `hidden="until-found"`.
- The `.sidebar-text` must not have any `display` or `visibility` CSS properties applied to it directly.
- The `.sidebar-text` panels MUST NOT carry `aria-expanded` themselves — that attribute belongs on the control (e.g. the toggling card) that reveals them.
- Each `.card` that reveals a `.sidebar-text` MUST be exposed as a toggle control (e.g. `role="button"` with `tabindex="0"`, or a real `<button>`), and MUST reference the panel it controls via `aria-controls`.
- The controlling card MUST carry `aria-expanded`, which stays in sync with whether its associated `.sidebar-text` is currently revealed.
- The `.sidebar-text` must use a fallback strategy for unsupported browsers. The implementation must include an explicit JavaScript feature detection check for native support (e.g., `if (!('onbeforematch' in HTMLElement.prototype))`) and execute a fallback UI strategy for unsupported browsers.
- The `beforematch` event handler MUST programmatically update assistive technology properties, such as updating `aria-expanded="true"` on the controlling card (the element that revealed the panel), NOT on the panel itself.