---
description: Orchestrate complex animations with promises and control their playback for smoother user experiences.
filename: web-animations-orchestration
category: ui
---

# Orchestrating animations with promises

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API
- https://developer.chrome.com/docs/css-ui/web-animations-api-2/

## Best Practices

Use `animation.finished` and `animation.ready` to create chained animations. This allows for sequential execution of animations, even across different elements and with varying parameters.

```javascript
const transformAnimation = modal.animate(openModal, openModalSettings);
transformAnimation.finished.then(() => {
  text.animate(fadeIn, fadeInSettings);
});
```

Leverage `.reverse()`, `.play()`, and `.pause()` methods for interactive control over animations, enabling smoother transitions and more intuitive user interactions.

```javascript
// Example for closing a modal
modal.animate(closeModal, closeModalSettings).finished.then(() => {
  // Further cleanup or subsequent actions
});
```

When animations are triggered by events like `mousemove`, use **replaceable animations** to automatically clean up finished animations that are superseded by new ones. This prevents memory leaks and improves performance.

```javascript
elem.addEventListener('mousemove', evt => {
  rectangle.animate(
    { transform: `translate(${evt.clientX}px, ${evt.clientY}px)` },
    { duration: 500, fill: 'forwards' }
  );
});
```

Use **composite modes** (`'replace'`, `'add'`, `'accumulate'`) to combine animations in controlled ways, allowing for more complex and layered visual effects.

```javascript
const bounce = menu.animate(
  [
    { top: '0px', easing: 'ease-in' },
    { top: '10px', easing: 'ease-out' },
    // ... more keyframes for bounce
  ],
  { duration: 300, composite: 'add' } // Using 'add' for compositing
);
```

## Fallback strategies

While modern browsers widely support the Web Animations API, consider the following for broader compatibility if necessary:

- **CSS Animations/Transitions:** For simpler animations, CSS `@keyframes` and `transition` properties offer a robust fallback.
- **JavaScript Animation Libraries:** Libraries like GSAP or Anime.js can provide more advanced features and consistent behavior across older browsers. Feature detection can be used to conditionally load these fallbacks.