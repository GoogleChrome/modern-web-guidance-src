# Expectations

- The component contains a native HTML `<progress>` element.
- The `<progress>` element does not have a `value` attribute, correctly signaling an indeterminate state.
- The `<progress>` element includes an `aria-label` (e.g., "Loading") for accessibility.
- The component is visible on the page.
- The visual spinner is implemented using a CSS `conic-gradient` with dynamic angles driven by CSS custom properties.
- The spinner uses a dual-animation approach: a continuous rotation (`progress-spin`) and a "dash" effect (`progress-dash`) that varies the length of the arc.
- The dash animation is implemented using `@property` to register and animate custom properties (`--arc-start`, `--arc-end`), and is conditionally included using a `--progress-dash-animation` property with `syntax: "*"`.
- If `@property` is not supported, the dash animation fails gracefully in CSS (no JS required), falling back to a simple rotating ring.
- The center of the progress ring is transparent or "hollowed out" using `background-clip: border-area`.
- If `background-clip: border-area` is not supported, fall back to hollowing out the center of the ring with a radial gradient mask. 
- The spinner respects `prefers-reduced-motion` by significantly slowing down the animation.
