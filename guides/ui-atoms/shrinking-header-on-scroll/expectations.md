* The agent has defined an `@keyframes` block that animates the header (e.g., shrinking its height).
* The agent has applied the animation to the header using `animation-timeline: scroll()` or `scroll(block root)`.
* The agent has used `animation-range` to specify the scroll distance over which the animation occurs (e.g., `0px 150px`).
* The header element has `position: fixed` or `position: sticky`.
* The implementation includes feature detection using `@supports` for scroll-driven animations.
* The implementation respects user preferences for reduced motion using `@media (prefers-reduced-motion: no-preference)`.
