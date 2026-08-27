# Expectations

- The component contains a native HTML `<progress>` element.
- The component is visible on the page.
- The visual progress ring is implemented using a CSS `conic-gradient`.
- The center of the progress ring is transparent or "hollowed out" using `background-clip: border-area`.
- If `background-clip: border-area` is not supported, fall back to hollowing out the center of the ring with a radial gradient mask. 
- The `value` attribute on `<progress>` is used to drive the visual progress of the ring using `attr()`.
- If using `attr()` on non-content properties is not supported, fallback to update the visual ring with JavaScript via the `--value` property.
- The component supports displaying text content (e.g., the percentage) in the center of the ring.
- The ring smoothly transitions between values when the `--value` property is updated (requiring `@property` support in the browser).
- The `<progress>` element includes an `aria-label` for accessibility.
- The component's fill color changes to a success color (e.g., green) when the progress value reaches 100%.
- The component has a distinct visual "track" (background) behind the progress fill.
- The spinner respects `prefers-reduced-motion` by changing to a new value immediately, rather than having a smooth transition.