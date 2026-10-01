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
  - prefers-reduced-motion
  - registered-custom-properties
---

# Motion

- Use `clip-path` and `mask-image` for custom geometric reveals and smooth fade-outs.
- Use **Scroll-Driven Animations** (`animation-timeline: scroll()`) for non-essential scroll-bound effects instead of JS listeners.
- Use **View Transitions** to animate between complex layout states seamlessly.

### Performance

- Prefer to animate `opacity` and `transform` (including individual transform properties, e.g. `translate` instead of `left/right/top/bottom`) to ensure animations stay on the compositor thread.
- Use `transition-behavior: allow-discrete` + `@starting-style` to animate layout properties like `display` or `<dialog>` state natively.

```css
.popover-reveal {
  /* Allow discrete animations for display transitions */
  transition: display 0.2s allow-discrete;
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
