# Expectations

- The component contains a native HTML `<progress>` element.
- The `<progress>` element does not have a `value` attribute, correctly signaling an indeterminate state.
- The `<progress>` element includes an `aria-label` (e.g., "Loading") for accessibility.
- The component is visible on the page.
- The visual spinner is implemented using a CSS `conic-gradient`.
- The center of the progress ring is transparent or "hollowed out" using `background-clip: border-area`.
- If `background-clip: border-area` is not supported, fall back to hollowing out the center of the ring with a radial gradient mask. 
- The spinner continuously rotates using a CSS animation on the `transform` property.
- The spinner respects `prefers-reduced-motion` by slowing down the animation (e.g., increasing `animation-duration`).
