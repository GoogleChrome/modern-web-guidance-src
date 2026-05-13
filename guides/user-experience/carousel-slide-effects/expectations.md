* The agent has defined an `@keyframes` block that defines states for at least start (0%), center (50%), and end (100%) to animate the slide as it traverses the scrollport.
* The agent has applied the animation to the carousel items using `animation-timeline: view()` or `view(inline)`.
* The agent has used `scroll-snap-type` on the scroller and `scroll-snap-align` on the items to enable snapping.
* The implementation includes feature detection using `@supports` for scroll-driven animations.
* The implementation respects user preferences for reduced motion using `@media (prefers-reduced-motion: no-preference)`.
* The carousel container MUST set `role="region"`, define `aria-roledescription="carousel"`, and provide an accessible name via `aria-label` or `aria-labelledby`.
* Individual slides MUST set `aria-roledescription="slide"`.
