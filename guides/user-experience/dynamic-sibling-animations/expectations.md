* The animation on the first element starts before the animation on the second element.
* `sibling-index()` is multiplied by a time and used as the `animation-delay`.
* If a legacy fallback is required, JavaScript checks if `sibling-index()` is supported, and if not, adds a custom property on each sibling element being animated, starting with 1. The `animation-delay` uses this property in its calculation, and a second `animation-delay` uses `sibling-index()`.
* If the user prefers reduced motion, the animation is disabled.
