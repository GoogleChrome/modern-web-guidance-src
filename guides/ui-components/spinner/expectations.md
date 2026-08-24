# Expectations

- The component contains a native HTML `<progress>` element.
- The `<progress>` element does not have a `value` attribute, correctly signaling an indeterminate state.
- The `<progress>` element includes an `aria-label` (e.g., "Loading") for accessibility.
- The `<progress>` element is visually hidden using a standard utility class (e.g., `.visually-hidden`).
- The component is visible on the page.
- The visual spinner is implemented using a CSS `conic-gradient` to create a fading trail.
- The center of the spinner is transparent or "hollowed out" using `mask-image`.
- The spinner continuously rotates using a CSS animation on the `transform` property.
- The spinner respects `prefers-reduced-motion` by slowing down the animation (e.g., increasing `animation-duration`).
