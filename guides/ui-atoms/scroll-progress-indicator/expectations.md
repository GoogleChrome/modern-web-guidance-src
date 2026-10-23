* The agent has defined an `@keyframes` block that animates `transform: scaleX()` from 0 to 1 (or similar scaling).
* The agent has applied the animation to the progress indicator element using `animation-timeline: scroll()`.
* The progress indicator element has `position: fixed` or `position: absolute` to stay in view.
* The progress indicator element has `transform-origin` set to the start (e.g., `0 50%` or `left`) so it scales from the correct side.
* The implementation includes feature detection using `@supports` for scroll-driven animations.
* The implementation respects user preferences for reduced motion using `@media (prefers-reduced-motion: no-preference)`.
* The implementation DOES NOT add any `scroll` event listeners.
