* The animation on the first element starts before the animation on the second element.
* `sibling-index()` is multiplied by a time and used as the `animation-delay`.
* The implementation provides a fallback for older browsers using CSS custom properties.
* The CSS is structured to use the custom property variables as a base and then override them with the native functions inside an @supports block (e.g., @supports (animation-delay: calc(sibling-index() * 0.1s)) { animation-delay: calc(sibling-index() * 0.1s); }).
* The custom property values start at 1 and increment for each sibling.
* The fallback is applied conditionally only when `sibling-index()` is not supported.
* If the user prefers reduced motion, the animation is disabled.
