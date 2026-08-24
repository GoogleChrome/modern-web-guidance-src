# Expectations

- The component contains a native HTML `<progress>` element.
- The component is visible on the page.
- The visual progress ring is implemented using a CSS `conic-gradient`.
- The center of the progress ring is transparent or "hollowed out" using `mask-image`.
- The `--value` CSS custom property is used to drive the visual progress of the ring.
- Methods that change the  `value` of the `<progress>` element also updates the visual ring via the `--value` property.
- The component supports displaying text content (e.g., the percentage) in the center of the ring.
- The ring smoothly transitions between values when the `--value` property is updated (requiring `@property` support in the browser).
- The `<progress>` element includes an `aria-label` for accessibility.
- The `<progress>` element is visually hidden using a standard utility class (e.g., `.visually-hidden`).
- The component's fill color changes to a success color (e.g., green) when the progress value reaches 100%.
- The component has a distinct visual "track" (background) behind the progress fill.
