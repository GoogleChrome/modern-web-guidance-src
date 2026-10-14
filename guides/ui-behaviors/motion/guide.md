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
  - nesting
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

**DO NOT** globally apply `animation-duration: 0.01ms;` as it can cause certain animations to become _more_ jarring.
Instead, handle motion preferences on a case-by-case basis using one of two approaches, nesting the `@media` query inside the rule so both versions are kept together:

- **Start with animations enabled by default, and tone them down using `@media (prefers-reduced-motion: reduce)`**:

```css
/* Good: Dampen spin states or slow down animations for reduced motion */
.spinner {
  animation: spin 1s linear infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 0.5;
  }
}

progress:not([value]) {
  animation: slide 1s infinite linear;
  @media (prefers-reduced-motion: reduce) {
    animation-duration: 20s;
  }
}
```

- **Start with no animations by default, and enable them using `@media (prefers-reduced-motion: no-preference)`**:

```css
/* Good: Default to static or gentle states and opt-in to full motion */
.spinner {
  opacity: 0.5;
  @media (prefers-reduced-motion: no-preference) {
    opacity: 1;
    animation: spin 1s linear infinite;
  }
}

progress:not([value]) {
  animation: slide 20s infinite linear;
  @media (prefers-reduced-motion: no-preference) {
    animation-duration: 1s;
  }
}
```
