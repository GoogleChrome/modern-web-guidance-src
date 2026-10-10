---
name: motion
description: Animate UI with CSS transitions, animations, scroll-driven animations, and view transitions while keeping motion on the compositor and respecting reduced-motion preferences.
web-feature-ids:
  - transitions
  - animations-css
  - clip-path
  - masks
  - scroll-driven-animations
  - view-transitions
  - individual-transforms
  - transition-behavior
  - starting-style
  - display-animation
  - overlay
  - prefers-reduced-motion
  - registered-custom-properties
---

# Motion

- Use `clip-path` and `mask-image` for custom geometric reveals and smooth fade-outs.
- Use **Scroll-Driven Animations** (`animation-timeline: scroll()`) for non-essential scroll-bound effects instead of JS listeners.
- Use **View Transitions** to animate between complex layout states seamlessly.

### Performance

- Prefer to animate `opacity` and `transform` (including individual transform properties, e.g. `translate` instead of `left/right/top/bottom`) to ensure animations stay on the compositor thread.
- Use `transition-behavior: allow-discrete`, `@starting-style`, and (for top-layer elements like `<dialog>` or `[popover]`) `overlay` to animate discrete entry and exit states natively; see {{ GUIDE_REF("animate-element-entry-exit") }} and {{ GUIDE_REF("animate-to-from-top-layer") }}.

```css
.popover-reveal {
  /* Transition discrete display and top-layer overlay alongside opacity */
  transition:
    opacity ease-out,
    display,
    overlay;
  transition-duration: 0.2s;
  transition-behavior: allow-discrete;
}
```

### Accessibility

Use `prefers-reduced-motion` media queries to turn off heavy motion for users who prefer it.
- **Provide Pause mechanism**: Allow users to stop auto-running carousels, banners, or other persistent animations.
- **Default to static views**: Consider defaulting to static states and allowing users to opt-in to motion.
- **Don't exceed flash limits (three per second)**: Never include rapid light-to-dark flashing. Such effects can cause seizures.

```css
/* Good: Dampen spin states for reduced motion queries */
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
    opacity: 0.5;
  }
}
```

**DO NOT** globally apply `animation-duration: 0.01ms;` globally as it can cause certain animations to become _more_ jarring.
Either apply reduced motion versions on a case by case basis, or use a custom property like:

```css
@property --animation-reduced {
  syntax: "*";
  inherits: false;
  initial-value: none;
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation: var(--animation-reduced) !important;
  }
}
```

Then, reduced motion versions can be kept together with the original animations:

```css
progress:not([value]) {
  animation: slide 1s infinite linear;
  --animation-reduced: slide 20s infinite linear;
}
```

### Working with animation and transition events in JavaScript

On both the `AnimationEvent` (`animationstart`, `animationiteration`, `animationend`, `animationcancel`) and `TransitionEvent` (`transitionrun`, `transitionstart`, `transitionend`, `transitioncancel`) interfaces, `event.target` gives you the originating DOM element. To access the specific `Animation` object (`Animation`, `CSSAnimation`, or `CSSTransition`) that triggered the event, use the readonly `event.animation` property.

When `event.animation` is not available, you can usually find the `Animation` instance by calling `event.target.getAnimations()` and filtering by `event.animationName` (or `event.propertyName` for transitions). However, using `event.animation` directly is preferred, in order to avoid several scenarios where this fallback that filters `event.target.getAnimations()` does not work as expected:

- Web Animations API (`element.animate()`) animations do not have an `animationName`, so they cannot be matched by name when filtering `event.target.getAnimations()`.
- Filtering by `animationName` for `AnimationEvent`s is ambiguous when multiple animations with the same name are attached to the same element.
  - Note that filtering on `transitionProperty` for `TransitionEvent`s works as there is only one event per transition property. 
- `event.target` always points to the originating DOM element, so it does not distinguish between animations running on the element itself versus one of its pseudo-elements — whereas `event.animation.effect.pseudoElement` exposes the target pseudo-element directly.

```js
// Works in most basic CSS animation cases, but fails for WAAPI animations,
// duplicate animation names on the same element, or pseudo-elements.
document.addEventListener('animationstart', (event) => {
  const animation = event.target
    .getAnimations()
    .find((anim) => anim.animationName === event.animationName);
  console.log(animation);
});

// PREFERRED: Directly access the exact Animation object via event.animation
document.addEventListener('animationstart', (event) => {
  const animation = event.animation;
  console.log(animation);
});
```

You can feature-detect support using `'animation' in AnimationEvent.prototype` (or `'animation' in TransitionEvent.prototype`).