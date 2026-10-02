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
---

# Animate Elements To and From Top Layer

Elements that render in the "top layer" (like `<dialog>`, elements with the `popover` attribute, or tooltips) have historically been difficult to animate because they toggle between `display: none` and a visible state. Modern CSS provides `@starting-style`, `transition-behavior: allow-discrete`, and the `overlay` property to enable smooth entry and exit transitions for these elements. Note that native CSS nesting is used in the examples below.

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
  transition-property: background-color, display, overlay;
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
- **MANDATORY**: Respect user preferences for reduced motion using `prefers-reduced-motion` by simplifying transitions (e.g., removing transforms and shortening duration).
- **DO**: Place the `@starting-style` block inside or after the "open" state selector to ensure proper cascading.
- **DO NOT**: Use `@starting-style` for exit animations; exit animations are defined by the transition to the base (closed) state.

## Fallback strategies

{{ BASELINE_STATUS("starting-style") }}
{{ BASELINE_STATUS("overlay") }}

{{ FEATURE_FALLBACKS("transition-behavior") }}

### Top-layer exit fallback

Entry animations work in pure CSS across all browsers that support `@starting-style`—no `.is-opening` class is needed because entry transitions do not depend on `overlay` or discrete `display` transitions.

Exit animations require both `overlay` and discrete `display` transition support. When either is unsupported (such as in Firefox and Safari), add `:not([data-closing])` to the open-state selectors from the Example (keeping the nested `@starting-style`) so setting `data-closing` triggers the exit transition while the element remains in the top layer, then wait for `getAnimations()` to settle before calling `.close()` or `.hidePopover()`:

```css
dialog[open]:not([data-closing]),
[popover]:popover-open:not([data-closing]) {
  opacity: 1;
  transform: scale(1);

  @starting-style {
    opacity: 0;
    transform: scale(0.9);
  }
}

dialog[open]:not([data-closing])::backdrop,
[popover]:popover-open:not([data-closing])::backdrop {
  background-color: rgba(0, 0, 0, 0.5);

  @starting-style {
    background-color: rgba(0, 0, 0, 0);
  }
}
```

```javascript
// Evaluate lazily: canTransitionDisplay() needs document.body, so a top-level
// const would be permanently false if this script runs in <head>.
function supportsTopLayerExit() {
  return window.CSS?.supports?.('overlay', 'auto') && canTransitionDisplay();
}

async function closeTopLayer(element) {
  if (!supportsTopLayerExit()) {
    element.setAttribute('data-closing', '');
    const animations = element.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((r) => setTimeout(r, 2000)),
      ]);
    }
    if (!element.hasAttribute('data-closing')) return;
    element.removeAttribute('data-closing');
  }

  element.close();
  // Or for popover:
  // element.hidePopover();
}

// Route native close requests (Esc, closedby light dismiss) through the same
// helper so they animate too, instead of closing instantly.
dialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeTopLayer(dialog);
});
```

Popover light dismiss and `popovertarget` toggles cannot be intercepted (`beforetoggle` is only cancelable when opening), so in browsers that need the fallback those exits are instant. Provide an explicit close control that calls `closeTopLayer()` if the exit animation matters.

{{ FEATURE_FALLBACKS("popover") }}
