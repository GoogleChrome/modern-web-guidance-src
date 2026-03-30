* The animation on the first element starts before the animation on the second element.
* `sibling-index()` is multiplied by a time and used as the `animation-delay`.
* The implementation provides a fallback for older browsers using CSS custom properties.
* The custom property values start at 1 and increment for each sibling.
* The fallback is applied conditionally only when `sibling-index()` is not supported.
* If the user prefers reduced motion, the animation is disabled.
