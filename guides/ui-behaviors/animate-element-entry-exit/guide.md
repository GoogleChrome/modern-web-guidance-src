---
name: animate-element-entry-exit
description: Smoothly hide/show elements as they are added/removed from the DOM or as their display values are toggled.
web-feature-ids:
  - starting-style
  - transition-behavior
---

# Animate Element Entry and Exit

In the past, CSS transitions could not animate elements when they were first added to the DOM or when their `display` property changed from `none`. The `@starting-style` at-rule and `transition-behavior: allow-discrete` provide a declarative way to create smooth entry and exit animations.

## Implementation

### 1. Animating `display: none` Toggles

To animate an element when toggling its visibility via an attribute (e.g., `hidden` with `display: none`):

1. **Define the visible state**: Set the final property values (e.g., `opacity: 1`) on the base class.
2. **Define the entry starting state**: Use `@starting-style` to specify the values to transition *from* when the element becomes visible.
3. **Enable discrete transitions**: Include `display` in the `transition` property and use `transition-behavior: allow-discrete`.
4. **Define the exit state**: Set the target values in the `hidden` attribute.

```css
.card {
  display: block;
  opacity: 1;
  translate: 0;
  /* MANDATORY: Use transition-behavior: allow-discrete for display transition */
  transition:
    display 0.4s,
    opacity 0.4s ease-out,
    translate 0.4s ease-out;
  transition-behavior: allow-discrete;
}

/* Entry animation: transition FROM these values when first rendered */
@starting-style {
  .card {
    opacity: 0;
    translate: 0 -20px;
  }
}

/* Exit animation: transition TO these values when hidden */
.card:where(.hidden, [hidden]) {
  display: none;
  opacity: 0;
  translate: 0 -20px;
}

/* Respect user preference for reduced motion */
@media (prefers-reduced-motion: reduce) {
  .card {
    /* Disable movement and shorten duration for a simple fade */
    translate: none;
    transition-duration: 0.1s;
  }

  @starting-style {
    .card {
      translate: none;
    }
  }

  .card:where(.hidden, [hidden]) {
    translate: none;
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

// 2. Wait for all active transitions/animations to finish,
//    with a failsafe timeout in case an animation never ends (e.g. for looping animations)
const animations = element.getAnimations();
if (animations.length > 0) {
  await Promise.race([
    // Promise.allSettled ensures we wait even if some animations fail
    Promise.allSettled(animations.map(a => a.finished)),
    new Promise(r => setTimeout(r, 2000))
  ]);
}

// 3. Finally remove the node from the DOM
element.remove();
```

## Constraints & Accessibility

- **MANDATORY**: Use `transition-behavior: allow-discrete` when transitioning `display`. Without it, the element will instantly disappear during exit.
- **DO NOT** use `allow-discrete` in the `transition` shorthand — it will make older browsers ignore the entire `transition` declaration. Except in use cases where that is desirable, use a separate `transition-behavior: allow-discrete` declaration.
- **MANDATORY**: Use `@starting-style` for entry animations. Browsers skip transitions on an element's first style update (initial render or `display: none` change) unless this is provided.
- **DO**: Include `overlay` in the `transition` list if animating top-layer elements like `<dialog>` or `popover` to ensure they stay in the top layer during the exit animation.
- **DO**: Respect user preferences for reduced motion using the `prefers-reduced-motion` media query.
- **DO NOT**: Rely on `@starting-style` for exit animations; it only defines the *starting* point for an entry transition. Exit animations are defined by the transition to the hidden state.

## Fallback strategies

{{ BASELINE_STATUS("starting-style") }}

{{ FEATURE_FALLBACKS("transition-behavior") }}

### Exit fallback when discrete `display` transitions are unsupported

Entry animations using `@starting-style` work across all modern browsers without JavaScript. When discrete `display` transitions are unsupported (`!canTransitionDisplay()`), separate the visual exit state (`[data-closing]`) from `display: none` (`[hidden]`) so `opacity` and `translate` finish animating before hiding the element:

```css
.card:where(.hidden, [hidden], [data-closing]) {
  opacity: 0;
  translate: 0 -20px;
}

.card:where(.hidden, [hidden]) {
  display: none;
}
```

```javascript
async function hideElement(el) {
  if (canTransitionDisplay()) {
    el.hidden = true;
    return;
  }

  el.setAttribute('data-closing', '');
  const animations = el.getAnimations();
  if (animations.length > 0) {
    await Promise.allSettled(animations.map((a) => a.finished));
  }
  if (el.hasAttribute('data-closing')) {
    el.removeAttribute('data-closing');
    el.hidden = true;
  }
}
```
