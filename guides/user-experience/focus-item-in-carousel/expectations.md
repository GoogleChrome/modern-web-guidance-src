# Expectations: `focus-item-in-carousel`

- Since `scroll-initial-target` is currently experimental (supported only in Chrome 133+ and Edge 133+ and absent from Safari and Firefox), developers MUST provide a fallback mechanism.
- For the `scroll-initial-target` property, the only valid values are `nearest` and `none`. It is not an animatable property.
- The `scroll-initial-target` property must be applied directly to the **child element** (the target) that needs to be scrolled into view (in `demo.html`, this is `.item.target`), not to its scroll container. The parent scroll container (`.carousel`) only needs to explicitly clip its content (e.g., using `overflow-x: auto`).
- The scroll adjustment occurs exactly once during the **initial layout** (or immediately upon insertion, provided no prior user interaction has occurred).
- If the user explicitly scrolls `.carousel` before the initial target is reached or resolved, `scroll-initial-target` is deactivated. Furthermore, standard fragment navigation (e.g., a URL `#hash`) always takes precedence over this property.
- The `scroll-initial-target` property only adjusts the **visual** scroll position; it does not move keyboard focus or change the active element.
- As a fallback, check for feature support using `CSS.supports('scroll-initial-target', 'nearest')` in JavaScript. If evaluated to `false`, programmatically call `targetItem.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' })` on the `.item.target` element. Note the use of `inline: 'center'` for carousels to horizontally center the item within `.carousel`.
- Pay attention to execution timing when implementing JavaScript fallbacks. To accurately approximate the native `scroll-initial-target` behavior, execute the `scrollIntoView` fallback on `DOMContentLoaded`, or ensure it runs only after both the `.item.target` element and its `.carousel` container have completely rendered.
