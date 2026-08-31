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
The spinner uses a `conic-gradient` to create a visual trail.

```css
@property --arc-start {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}
@property --arc-end {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

progress.loading-spinner:indeterminate {
  --_from: calc(90deg + var(--arc-start));
  --_to: calc(90deg + var(--arc-end));
  --size: 40px;
  --thickness: 2px;
  --spinner-color: #3b82f6;
  --track-color: #e2e5e7;
  --spinner-duration: 1.5s;
  --_used-spinner-duration: var(--spinner-duration);
  --dash-duration: 3s;
  --_used-dash-duration: var(--dash-duration);
  --spinner-timing: linear;

  position: relative;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  appearance: none;

  /* Create the fading trail with dynamic angles */
  background: conic-gradient(
      from var(--_from),
      var(--spinner-color) calc(var(--_to) - var(--_from)),
      transparent 0
    )
    var(--track-color);

  @supports (background-clip: border-area) {
    background-clip: border-area;
    border: var(--thickness) solid transparent;
    background-origin: border-box;
  }

  /* ... fallback for background-clip: border-area ... */

  animation:
    progress-spin var(--_used-spinner-duration) linear infinite,
    progress-dash var(--_used-dash-duration) ease-in-out infinite;
}

@keyframes progress-spin {
  to { rotate: 1turn; }
}

@keyframes progress-dash {
  from {
    --arc-start: 0deg;
    --arc-end: 3deg;
  }
  50% {
    --arc-start: 100deg;
    --arc-end: 358deg;
  }
  to {
    --arc-start: 360deg;
    --arc-end: 363deg;
  }
}
```

#### Respecting Motion Preferences

Users with motion sensitivities may find fast-spinning elements disorienting. Always respect the `prefers-reduced-motion` media query. Set the internal `--_used-spinner-duration` property to override the user's `--spinner-duration` value.

```css
@media (prefers-reduced-motion: reduce) {
  .loading-spinner {
    /* Slow down the animation significantly rather than stopping it entirely,
       so the user still knows that the process is active. */
    --_used-spinner-duration: 6s;
  }
}
```

## Fallback strategies

{{ FEATURE_FALLBACKS("registered-custom-properties") }}

If `@property` is not supported, the dash animation will not function. You should provide a script to disable the dash animation (allowing it to fall back to a simple rotation) in these browsers.

```js
if (!("registerProperty" in CSS)) {
  // disable dash animation
  const spinners = document.querySelectorAll(".loading-spinner");
  spinners.forEach((spinner) => {
    spinner.style.setProperty("--dash-duration", "0s");
  });
}
```

You must also provide fallback values when using the values set by the dash animation.

```css
--_from: calc(90deg + var(--arc-start, 0deg));
--_to: calc(90deg + var(--arc-end, 158deg));
```

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