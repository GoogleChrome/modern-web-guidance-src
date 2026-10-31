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
  - web-animations
---

# Motion

- Use `clip-path` and `mask-image` for custom geometric reveals and smooth fade-outs. Both also clip the element's own focus outline, so when the clipped or masked element is focusable (for example, a scroll container with `tabindex="0"`), draw its focus indicator on a parent element that isn't clipped or masked.
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

Use `prefers-reduced-motion` media queries to turn off non-essential motion for users who prefer it.
- **Provide Pause mechanism**: Allow users to stop auto-running carousels, banners, or other persistent animations. Any moving, blinking, or scrolling content that starts automatically, lasts more than five seconds, and is shown alongside other content needs a visible control to pause, stop, or hide it, such as a `<button>` next to the content that works with the keyboard (WCAG 2.2.2 Pause, Stop, Hide). `prefers-reduced-motion` doesn't replace the control, because users who haven't turned on that setting still need to stop the motion. If the button's label changes between "Pause" and "Play", don't also set `aria-pressed`, or screen readers announce a pressed "Play" button.
- **Default to static views**: Consider defaulting to static states and allowing users to opt-in to motion.
- **Don't exceed flash limits (three per second)**: Never include rapid light-to-dark flashing. Such effects can cause seizures. This applies whatever the user's motion preference, so don't put flashing content inside `@media (prefers-reduced-motion: no-preference)` either (WCAG 2.3.1 Three Flashes or Below Threshold: nothing flashes more than three times in any one-second period).
- **Keep the final state**: When you turn off an animation, make sure the element still ends in its final state, so content isn't left hidden (for example, at `opacity: 0`) and focus and selection indicators still appear.

**DO NOT** globally apply `animation-duration: 0.01ms;` as it can cause certain animations to become _more_ jarring.
Instead, handle motion preferences on a case-by-case basis using one of two approaches, nesting the `@media` query inside the rule so both versions are kept together:

- **Start with animations enabled by default, and turn them off using `@media (prefers-reduced-motion: reduce)`**:

```css
/* Good: Animate by default, and stop the animations when the user prefers
   reduced motion */
.spinner {
  animation: spin 1s linear infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

progress:not([value]) {
  animation: slide 1s infinite linear;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}
```

- **Start with no animations by default, and enable them using `@media (prefers-reduced-motion: no-preference)`**:

```css
/* Good: Don't animate by default, and add the animations only when the user
   hasn't asked for reduced motion */
.spinner {
  @media (prefers-reduced-motion: no-preference) {
    animation: spin 1s linear infinite;
  }
}

progress:not([value]) {
  @media (prefers-reduced-motion: no-preference) {
    animation: slide 1s infinite linear;
  }
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

Under `prefers-reduced-motion: reduce`, an animation set to `none`, or a transition that is removed or given a zero duration and no delay, never fires `animationend` or `transitionend`. If your code waits for these events to remove or hide an element, continue immediately when `element.getAnimations()` returns an empty array, or keep a short opacity transition instead of removing it.
