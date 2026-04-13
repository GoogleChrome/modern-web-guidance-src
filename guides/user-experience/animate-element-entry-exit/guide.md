---
name: animate-element-entry-exit
description: Smoothly hide/show elements as they are added/removed from the DOM or as their display values are toggled.
web-feature-ids:
  - starting-style
  - transition-behavior
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style
  - https://developer.mozilla.org/en-US/docs/Web/CSS/transition-behavior
  - https://web.dev/blog/baseline-entry-animations
  - https://www.smashingmagazine.com/2025/01/transitioning-top-layer-entries-display-property-css/
---

In the past, CSS transitions could not animate elements when they were first added to the DOM or when their `display` property changed from `none`. The `@starting-style` at-rule and `transition-behavior: allow-discrete` provide a declarative way to create smooth entry and exit animations.

## Implementation

### 1. Animating `display: none` Toggles

To animate an element when toggling its visibility via an attribute (e.g., `hidden` with `display: none`):

1. **Define the visible state**: Set the final property values (e.g., `opacity: 1`) on the base class.
2. **Define the entry starting state**: Use `@starting-style` to specify the values to transition *from* when the element becomes visible.
3. **Enable discrete transitions**: Include `display` in the `transition` property and use the `allow-discrete` keyword.
4. **Define the exit state**: Set the target values in the `hidden` attribute.

```css
.card {
  display: block;
  opacity: 1;
  transform: translateY(0);
  /* MANDATORY: Use allow-discrete for display transition */
  transition:
    display 0.4s allow-discrete,
    opacity 0.4s ease-out,
    transform 0.4s ease-out;
}

/* Entry animation: transition FROM these values when first rendered */
@starting-style {
  .card {
    opacity: 0;
    transform: translateY(-20px);
  }
}

/* Exit animation: transition TO these values when hidden */
.card:where(.hidden, [hidden]) {
  display: none;
  opacity: 0;
  transform: translateY(-20px);
}

/* Respect user preference for reduced motion */
@media (prefers-reduced-motion: reduce) {
  .card {
    /* Disable movement and shorten duration for a simple fade */
    transform: none;
    transition-duration: 0.1s;
  }

  @starting-style {
    .card {
      transform: none;
    }
  }

  .card:where(.hidden, [hidden]) {
    transform: none;
  }
}
```

### 2. Animating DOM Insertion and Removal

For elements added via `appendChild()` or removed via `remove()`:

- **Entry**: Use `@starting-style` as shown above. The browser will automatically detect the style change from "nothing" to the element's initial styles and trigger the transition from the `@starting-style` values.
- **Removal**: Since `element.remove()` is instantaneous and doesn't trigger a CSS transition on its own, you must trigger the exit transition first (e.g., by adding a class) and wait for it to finish before removing the node from the DOM.

```javascript
// Trigger exit transition
element.setAttribute('hidden', true);

// 2. Wait for all active transitions/animations to finish
const animations = element.getAnimations();
if (animations.length > 0) {
  // Promise.allSettled ensures we wait even if some animations fail
  await Promise.allSettled(animations.map(a => a.finished));
}

// 3. Finally remove the node from the DOM
element.remove();
```

## Constraints & Accessibility

- **MANDATORY**: Use `allow-discrete` (either via `transition-behavior: allow-discrete` or the `allow-discrete` keyword in the `transition` shorthand) when transitioning `display`. Without it, the element will instantly disappear during exit.
- **MANDATORY**: Use `@starting-style` for entry animations. Browsers skip transitions on an element's first style update (initial render or `display: none` change) unless this is provided.
- **DO**: Include `overlay` in the `transition` list if animating top-layer elements like `<dialog>` or `popover` to ensure they stay in the top layer during the exit animation.
- **DO**: Respect user preferences for reduced motion using the `prefers-reduced-motion` media query.
- **DO NOT**: Rely on `@starting-style` for exit animations; it only defines the *starting* point for an entry transition. Exit animations are defined by the transition to the hidden state.

## Fallback strategies

{{ BASELINE_STATUS("starting-style") }}

For browsers that do not support these features, elements will toggle `display: none` instantly. You can detect support in JavaScript using `CSS.supports()` to conditionally apply manual animation logic.

```javascript
// Detect support for discrete transitions and starting-style
const supportsModernTransitions = 
  window.CSS && 
  CSS.supports('transition-behavior', 'allow-discrete');

if (!supportsModernTransitions) {
  // Implement manual JS-based fallback for entry/exit
}
```

### Manual Entry Animation (JS Fallback)

```javascript
// To show:
el.style.display = 'block';
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    el.classList.remove('hidden');
  });
});

// To hide:
el.setAttribute('hidden', true);
el.addEventListener('transitionend', () => {
  if (el.classList.contains('hidden')) el.style.display = 'none';
}, { once: true });
```
