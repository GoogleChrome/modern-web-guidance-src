---
description: Design accessible animations that respect user preferences for reduced motion, ensuring a better experience for all users.
filename: accessible-animation
category: a11y
---

# Accessible Animation

This page discusses how to implement animations that can be reduced or disabled based on user preference, ensuring a more inclusive web experience.

## Best Practices

Use the `prefers-reduced-motion` media query to progressively enhance animations. This allows users who prefer less motion to have a simpler experience, while others can still enjoy full animations.

For users who might experience nausea or distraction from excessive animation, providing a way to reduce or disable animations entirely is crucial.

### Progressive Enhancement with `prefers-reduced-motion`

- **DO** use the `prefers-reduced-motion` media query to detect if a user has requested less motion.
- **DO** provide an alternative, simpler animation or disable animation for users who prefer reduced motion.
- **DO** ensure that essential functionality is not dependent on animations.

```css
/* Default animation */
.animated-element {
  animation: spin 2s linear infinite;
}

/* Animation for users who prefer reduced motion */
@media (prefers-reduced-motion: reduce) {
  .animated-element {
    animation: none;
    /* Or provide a simpler animation */
    /* animation: fade-in 1s ease-in-out; */
  }
}
```

### Implementing a "Reduce Animation" Switch

Consider offering a user-controlled switch to toggle animations. This can be implemented using JavaScript and local storage to persist the user's preference.

- **DO** provide a clear and accessible UI control for users to manage animation preferences.
- **DO** use JavaScript to detect user interaction with the switch.
- **DO** store the user's preference (e.g., in `localStorage`) so it persists across sessions.
- **DO** apply the animation reduction based on the stored preference.

```javascript
const reduceMotionToggle = document.getElementById('reduce-motion-toggle');
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

// Function to apply animation preference
function applyAnimationPreference() {
  if (localStorage.getItem('prefersReducedMotion') === 'true' || prefersReduced.matches) {
    document.body.classList.add('reduce-motion');
  } else {
    document.body.classList.remove('reduce-motion');
  }
}

// Initial application of preference
applyAnimationPreference();

// Listen for changes to the system preference
prefersReduced.addEventListener('change', applyAnimationPreference);

// Listen for changes to the toggle switch
if (reduceMotionToggle) {
  reduceMotionToggle.addEventListener('change', () => {
    const isReduced = reduceMotionToggle.checked;
    localStorage.setItem('prefersReducedMotion', isReduced);
    applyAnimationPreference();
  });
}
```

## Fallback Strategies

For older browsers that may not support `prefers-reduced-motion`, consider graceful degradation.

- **DO NOT** rely solely on `prefers-reduced-motion` for critical accessibility.
- **DO** ensure that content is still understandable and usable without any animations.

## Further Reading

- Media Queries 5 → [https://goo.gle/2RVQxLw](https://goo.gle/2RVQxLw)
- Preference Reduced Motion Demo →[https://goo.gle/2G9hgl8](https://goo.gle/2G9hgl8)
- Reduce Motion Checkbox Demo →  [https://goo.gle/306S1XM](https://goo.gle/306S1XM)