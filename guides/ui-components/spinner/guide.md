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

Use the native `<progress>` element as both the semantic source of truth and the visual component. Without a `value` attribute, it is implicitly indeterminate.

```html
<progress aria-label="Loading" class="loading-spinner"></progress>
```

### 2. Styles

#### Hiding Native UI
To style the `<progress>` element as a spinner, first hide the default browser styling for indeterminate progress bars.

```css
/* Hide native bars */
progress.loading-spinner:indeterminate::-webkit-progress-bar {
  display: none;
  background: none;
}
progress.loading-spinner:indeterminate::-webkit-progress-value {
  display: none;
  background: none;
}
progress.loading-spinner:indeterminate::-moz-progress-bar {
  display: none;
  background: none;
}
progress.loading-spinner:indeterminate::slider-fill {
  display: none;
  background: none;
}
```

#### Spinner Ring and Trail
The spinner uses a `conic-gradient` to create a visual trail. Use `background-clip: border-area` to constrain the gradient to the border region. 

```css
progress.loading-spinner:indeterminate {
  --size: 40px;
  --thickness: 2px;
  --spinner-color: #3b82f6;
  --track-color: #e2e5e7;
  --spinner-duration: 0.8s;
  --_used-spinner-duration: var(--spinner-duration);
  --spinner-timing: linear;

  position: relative;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  appearance: none;

  /* Create the fading trail */
  background: conic-gradient(
    from 0deg,
    var(--track-color) 25%,
    var(--spinner-color) 25%
  );

  background-clip: border-area;
  border: var(--thickness) solid transparent;
  background-origin: border-box;

  animation: spinner-rotate var(--_used-spinner-duration)
    var(--spinner-timing) infinite;
}

@keyframes spinner-rotate {
  to { transform: rotate(360deg); }
}
```

You can also use a `radial-gradient` to make rounded end caps.

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

## Fallback strategies

{{ FEATURE_FALLBACKS("background-clip-border-area") }}

For browsers that don't yet support `background-clip: border-area`, fall back to a `mask-image` to hollow out the center.

```css
/* Fallback: use mask-image to create the ring */
@supports not (background-clip: border-area) {
  --clip-boundary: calc(100% - var(--thickness));
  mask-image: radial-gradient(
    farthest-side,
    transparent var(--clip-boundary),
    black var(--clip-boundary)
  );
  border: 0;
}
```