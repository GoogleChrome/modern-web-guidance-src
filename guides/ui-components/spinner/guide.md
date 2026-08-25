---
name: spinner
description: Build a loading spinner that communicates busy state to all users, respects reduced-motion preferences, and animates efficiently.
web-feature-ids:
  - prefers-reduced-motion
  - conic-gradients
  - progress
---

## Overview

A loading spinner (or activity indicator) informs users that a process is underway when the exact duration is unknown. Unlike a progress ring, a spinner is "indeterminate" and typically uses animation to signal activity.

This guide implements a spinner by:

- Using the native `<progress>` element as the semantic foundation. By omitting the `value` attribute, the browser treats it as an indeterminate progress bar, ensuring correct announcement by assistive technologies.
- Styling the component with `conic-gradient()` to create a visual "trail" and `mask-image` to hollow out the center into a ring.
- Animating the spinner efficiently using CSS transforms and respecting `prefers-reduced-motion` to ensure a comfortable experience for all users.

See {{ GUIDE_REF("progress-ring") }} for handling determinate tasks with a known duration.


## Implementation

### 1. Markup

We use a wrapper to hold the visual spinner. The `<progress>` element remains the semantic source of truth. Without a `value` attribute, it is implicitly indeterminate.

```html
<div class="loading-spinner">
  <progress aria-label="Loading" class="visually-hidden"></progress>
  <!-- The visual ring is created by the container itself -->
</div>
```

Alternatively, you may choose to omit the `<progress>` element, and add the `status` ARIA role to the `.loading-spinner` `<div>` element.

### 2. Styles

#### Spinner Ring and Trail

The spinner uses a `conic-gradient` to create a fading trail effect. `mask-image` is used to create the ring shape. To ensure the loader is only shown when it is exposed to the accessibility tree, use `:has(> progress:indeterminate)`. Wrap that in `.loading-spinner:where()` to allow users to override the custom variables with a simple `.loading-spinner` selector.

```css
.loading-spinner:where(.loading-spinner:has(> progress:indeterminate)) { 
  --size: 40px;
  --thickness: 4px;
  --spinner-color: #3b82f6;
  --spinner-duration: 0.8s;
   --_used-spinner-duration: var(--spinner-duration);
  --spinner-timing: linear;
  
  position: relative;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;

  /* Create a fading trail from the spinner color to transparent */
  background: conic-gradient(
    from 0deg,
    var(--spinner-color),
    transparent 75%
  );

  /* Hollow out the center to create a ring */
  mask-image: radial-gradient(
    transparent calc(50% - var(--thickness)),
    black calc(50% - var(--thickness) + 0.5px)
  );

  /* Continuous rotation animation */
  animation: spinner-rotate var(--spinner-duration) var(--spinner-timing) infinite;
}

@keyframes spinner-rotate {
  to { transform: rotate(360deg); }
}

/* Standard utility to visually hide elements while keeping them accessible */
.visually-hidden:where(:not(:focus-within, :active)) {
  position: absolute !important;
  clip-path: inset(50%) !important;
  overflow: hidden !important;
  width: 1px !important;
  height: 1px !important;
  margin: -1px !important;
  padding: 0 !important;
  border: 0 !important;
  white-space: nowrap !important;
}
```

#### Respecting Motion Preferences

Users with motion sensitivities may find fast-spinning elements disorienting. Always respect the `prefers-reduced-motion` media query. Set the internal `--_used-spinner-duration` property to override the user's `--spinner-duration` value.

```css
@media (prefers-reduced-motion: reduce) {
  .loading-spinner {
    /* Slow down the animation significantly rather than stopping it entirely,
       so the user still knows that the process is active. */
    --_used-spinner-duration: 3s;
  }
}
```
Alternatively, replace the spinner with a static text label for users with `prefers-reduced-motion` enabled.
