* The agent has defined separate `@keyframes` for entry (e.g., grow) and exit (e.g., shrink) effects.
* The agent has applied both animations to the target elements (e.g., `animation: grow ..., shrink ...`).
* The agent has used `animation-timeline: view()` or `view(inline)` to link animations to the view timeline.
* The agent has used `animation-range: entry, exit` (or explicit ranges for each) to restrict animations to the entry and exit phases.
* The implementation includes feature detection using `@supports ((animation-timeline: view()) and (animation-range: entry))`.
* The implementation respects user preferences for reduced motion using @media (prefers-reduced-motion).
