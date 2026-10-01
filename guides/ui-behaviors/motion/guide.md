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

On both the `AnimationEvent` (`animationstart`, `animationiteration`, `animationend`, `animationcancel`) and `TransitionEvent` (`transitionrun`, `transitionstart`, `transitionend`, `transitioncancel`) interfaces, use the readonly `event.animation` attribute to access the associated `Animation` object (`CSSAnimation` or `CSSTransition`) that triggered the event.

- **DO** use `event.animation` (and `event.animation.effect.target`) to directly inspect the `Animation` instance and identify the exact element (or pseudo-element via `event.animation.effect.pseudoElement`) that fired the animation or transition event.
- **DO NOT** blindly read `event.animationName` and manually loop over `document.getAnimations()` to find the matching animation or target element when multiple elements can share the same `animation-name`.
- **DO NOT** blindly read `event.transitionProperty` and manually loop over `document.getAnimations()` to find the matching animation or target element when multiple elements have transitions on the same property.

```js
// BAD: Fragile when multiple elements use the same animation-name
document.addEventListener('animationstart', (event) => {
  const animation = document
    .getAnimations()
    .find((anim) => anim.animationName === event.animationName);
  const element = animation?.effect?.target;
});

// GOOD: Directly access the Animation object and its target element via event.animation
document.addEventListener('animationstart', (event) => {
  const animation = event.animation;
  const element = event.animation.effect.target;
});
```

#### Feature detection and fallback

You can feature-detect support using `'animation' in AnimationEvent.prototype` (or `'animation' in TransitionEvent.prototype`).

In browsers that do not support `event.animation` matching `event.animationName` against `document.getAnimations()` only works reliably if there is a single element running an animation with that `animation-name` (see earlier example).

As an alternative, you can attach the event listener directly to the target element and use its reference:

```js
const el = document.querySelector('.animated-box');

el.addEventListener('animationend', (e) => {
  console.log(el); // The .animated-box element
});
```

Once you have the element, you get its animations, and then filter those by the event’s `animationName`

```js
const el = document.querySelector('.animated-box');

el.addEventListener('animationend', (e) => {
  const animations = Array.from(el.getAnimations());
  const currentAnimation = animations.find(
    (animation) => animation.animationName === e.animationName
  );
  console.log(currentAnimation);
});
```

The code above only works if there is only 1 animation with that name on the element, and if the animation was created as a CSS Animation. A WAAPI-created animation does not have a name, and can therefor not be filtered in the same way.