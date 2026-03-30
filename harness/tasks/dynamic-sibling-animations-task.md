---
base_app: daily-grind
grader: dynamic-sibling-animations
---
add a 0.4s fade-in animation to the cards in the .grid so they stagger in sequentially. use the css sibling-index() function for the animation-delay multiplied by a 0.1s stagger time. also include a js fallback that sets a --sibling-index variable for older browsers, but make sure to wrap it in a CSS.supports check so it doesn't run if it's not needed. disable the animation entirely if the user prefers reduced motion.
