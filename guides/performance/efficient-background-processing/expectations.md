# Expectations: `efficient-background-processing`

- The target element must have `content-visibility: auto` applied in its computed styles.
- The target element must have a non-zero `contain-intrinsic-size` applied to provide a placeholder height.
- The application must respond to the `contentvisibilityautostatechange` event.
- The application must pause active canvas animations or high-frequency tasks when the `contentvisibilityautostatechange` event reports `skipped: true`.
- The application must resume active canvas animations or high-frequency tasks when the `contentvisibilityautostatechange` event reports `skipped: false`.
- If `content-visibility` is not supported, the application must use `IntersectionObserver` to pause tasks when the element leaves the viewport.
