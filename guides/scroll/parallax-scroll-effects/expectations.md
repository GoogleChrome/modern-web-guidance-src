* The agent has defined an `@keyframes` block that animates the `transform` property (e.g., `translateY`) to create the parallax effect.
* The agent has defined a `view-timeline` on the wrapper element or uses an anonymous view timeline.
* The agent has applied the `animation-timeline` property to the layers to link them to the timeline.
* The agent has staggered the animations across different layers (e.g., using `sibling-index()` or hardcoded offsets) so they move at different rates.
* The wrapper element has `overflow: clip` or `overflow: hidden`.
* The implementation includes feature detection using `@supports` for scroll-driven animations (e.g., checking for `animation-timeline`).
* The implementation respects user preferences for reduced motion using @media (prefers-reduced-motion).
