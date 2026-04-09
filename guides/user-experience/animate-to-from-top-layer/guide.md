---
name: animate-to-from-top-layer
description: Animate elements such as dialogs, popovers, and tooltips as they're entering/exiting the top layer.
web-feature-ids:
  - backdrop
  - dialog
  - overlay
  - popover
  - starting-style
  - transition-behavior
sources:
  - https://web.dev/articles/baseline-in-action-dialog-popover
  - https://web.dev/blog/baseline-entry-animations
  - https://developer.chrome.com/blog/entry-exit-animations
  - https://www.smashingmagazine.com/2025/01/transitioning-top-layer-entries-display-property-css/
  - https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style
  - https://developer.mozilla.org/en-US/docs/Web/CSS/overlay
---

Elements that render in the "top layer" (like `<dialog>`, elements with the `popover` attribute, or tooltips) have historically been difficult to animate because they toggle between `display: none` and a visible state. Modern CSS provides `@starting-style`, `transition-behavior: allow-discrete`, and the `overlay` property to enable smooth entry and exit transitions for these elements.

## Implementation

### 1. Enable Discrete Transitions

To animate the `display` property, you must set `transition-behavior: allow-discrete`. This allows the element to remain visible during its exit transition. If using transition shorthands, be sure to place the `transition-behavior: allow-discrete` afterwards to prevent the shorthand from negating it.

### 2. The `overlay` Property

When an element moves in or out of the top layer, it must transition the `overlay` property. This ensures the element stays in the top layer for the duration of the animation, preventing it from being clipped by other elements or the viewport prematurely.

### 3. Entry Animations with `@starting-style`

Use the `@starting-style` at-rule to define the styles an element should transition *from* when it is first rendered or its `display` changes from `none`.

### 4. Animating the Backdrop

The `::backdrop` pseudo-element can be animated similarly by applying transitions to its own properties.

## Example

```css
/* 1. Define the visible (open) state */
dialog[open],
[popover]:popover-open {
  opacity: 1;
  transform: scale(1);

  /* 2. Define the starting state for entry (must come after open state) */
  @starting-style {
    opacity: 0;
    transform: scale(0.9);
  }
}

/* 3. Define the base (closed/exit) state and transitions */
dialog,
[popover] {
  opacity: 0;
  transform: scale(0.9);

  /* MANDATORY: transition display and overlay for top-layer elements */
  transition-property: opacity, transform, display, overlay;
  transition-duration: 0.3s;
  transition-timing-function: ease-out;
  /* Applies to discrete properties like display and overlay */
  transition-behavior: allow-discrete; /* Note: be sure to write this after the shorthand */
}

/* 4. Animate the backdrop */
dialog::backdrop,
[popover]::backdrop {
  background-color: rgba(0, 0, 0, 0);
  transition-property: display, overlay, background-color;
  transition-duration: 0.3s;
  transition-timing-function: ease-out;
  transition-behavior: allow-discrete;
}

dialog[open]::backdrop,
[popover]:popover-open::backdrop {
  background-color: rgba(0, 0, 0, 0.5);

  @starting-style {
    background-color: rgba(0, 0, 0, 0);
  }
}

/* 5. Respect user preference for reduced motion */
@media (prefers-reduced-motion: reduce) {
  dialog,
  [popover] {
    /* Disable movement and shorten duration for a simple fade */
    transform: none;
    transition-duration: 0.1s;
  }

  @starting-style {
    dialog[open],
    [popover]:popover-open {
      transform: none;
    }
  }
}
```

## Constraints & Accessibility

- **MANDATORY**: Include `overlay` in your `transition` list for any element moving into or out of the top layer.
- **MANDATORY**: Use `allow-discrete` for the `display` property transition.
- **DO**: Place the `@starting-style` block inside or after the "open" state selector to ensure proper cascading.
- **DO**: Respect user preferences for reduced motion using `prefers-reduced-motion`.
- **DO NOT**: Use `@starting-style` for exit animations; exit animations are defined by the transition to the base (closed) state.

## Fallback strategies

{{ BASELINE_STATUS("starting-style") }}

For browsers that do not support these features, top-layer elements will appear and disappear instantly. To provide animations in older browsers, you must use JavaScript to coordinate classes and wait for `transitionend` events or use the Web Animations API.

```javascript
// Feature detection for discrete transitions
const supportsDiscreteTransitions =
  window.CSS && CSS.supports('transition-behavior', 'allow-discrete');

if (!supportsDiscreteTransitions) {
  // Manual JS fallback for entry/exit animations
}
```
