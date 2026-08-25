---
name: progress-ring
description: Build a progress ring component that visually represents the completion status of a task or process, with support for content in the center and brand-consistent styling.
web-feature-ids:
  - progress
  - conic-gradients
  - masks
  - registered-custom-properties
---

## Overview

A progress ring (or circular progress bar) provides visual feedback on the status of a task. Unlike a linear progress bar, its circular shape is ideal for dashboards, card components, or anywhere space is constrained.

This guide implements a progress ring by:

- Using the native `<progress>` element as the semantic foundation to ensure the component is accessible to screen readers and keyboard users out-of-the-box.
- Styling the component with `conic-gradient()` and `mask-image`, allowing for a fully responsive and themeable ring without the complexity of SVG path manipulation.
- Leveraging CSS Custom Properties and `@property` to enable smooth, GPU-accelerated transitions of the progress fill.

This approach is preferred over SVG-only solutions because it uses the semantic `<progress>` element rather than ARIA, and more easily integrates with existing layout, design systems and typography.

See the {{ GUIDE_REF("spinner") }} for handling indeterminate loading states.

## Implementation

### 1. Markup

Use a wrapper to hold both the visual ring and the optional center content. The `<progress>` element remains the semantic source of truth. Use a utility class to visually hide the native progress bar while keeping it accessible.

```html
<div class="progress-ring-wrapper" style="--value: 75;">
  <div class="progress-ring">
    <progress value="75" max="100" aria-label="Task progress" class="visually-hidden"></progress>
  </div>
  <!-- Optional: Content to display in the center -->
  <div class="progress-ring-content">
    75%
  </div>
</div>
```

### 2. Styles

#### Container and Ring

The wrapper provides the positioning context. The `progress-ring` element handles the visual gradient and mask.

```css
.progress-ring-wrapper {
  --size: 120px;
  --thickness: 12px;
  --track-color: #eee;
  --fill-color: #3b82f6;

  position: relative;
  display: grid;
  place-items: center;
  width: var(--size);
  height: var(--size);
}

.progress-ring {
  width: 100%;
  height: 100%;
  border-radius: 50%;

  /* The progress fill is a conic gradient mapped to the --value */
  background: conic-gradient(
    var(--fill-color) calc(var(--value) * 1%),
    var(--track-color) 0
  );

  /* Create the "ring" by masking out the center */
  mask-image: radial-gradient(
    transparent calc(50% - var(--thickness)),
    black calc(50% - var(--thickness) + 0.5px)
  );
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

.progress-ring-content {
  /* Positioned in the center of the wrapper */
  position: absolute;
}
```

#### Enable smooth transitions with `@property`

To animate the progress ring smoothly when the value changes, register `--value` as a numeric custom property.

```css
@property --value {
  syntax: '<number>';
  inherits: true;
  initial-value: 0;
}

.progress-ring-wrapper {
  transition: --value 0.3s ease-in-out;
}

```

### 3. Progress Updates

Update the `--value` custom property on the wrapper whenever the `<progress>` value changes.

```html
<input type="range" min="0" max="100" value="75" id="range">

<script>
  const range = document.getElementById('range');
  const wrapper = document.querySelector('.progress-ring-wrapper');
  const progress = wrapper.querySelector('progress');
  const content = wrapper.querySelector('.progress-ring-content');

  range.addEventListener('input', (e) => {
    const newValue = e.target.value;
    
    // Update semantic value
    progress.value = newValue;
    
    // Update visual value
    wrapper.style.setProperty('--value', newValue);
    
    // Update optional center content
    content.textContent = `${newValue}%`;
  });
</script>
```

### 4. Optional Success State

You can use the CSS `:has()` pseudo-class to automatically update the ring's appearance (e.g., changing the color to green) when the task reaches completion.

```css
/* Change the fill color to green when the progress reaches 100% */
.progress-ring-wrapper:has(progress[value="100"]) {
  --fill-color: #10b981;
}
```

### 5. Respecting Motion Preferences

Users with motion sensitivities may find the transition between values disorienting. Respect the `prefers-reduced-motion` media query by transitioning immediately.


```css
@media (prefers-reduced-motion: reduce) {
  .progress-ring-wrapper {
    transition-duration: 0s;
  }
}
```

## Fallback strategies

The core components of this implementation — `<progress>` and `conic-gradient()` and `mask-image` with `radial-gradient()` — are Baseline Widely available. The registered `@property` for animation is the only modern addition.

Do not add a fallback value inside the `<progress>` element. It is not used by assistive technology and ignored by all modern browsers.

#### Animation fallback

{{ FEATURE_FALLBACKS("registered-custom-properties") }}

If `@property` is not supported, the ring will jump to the new value instantly instead of transitioning smoothly. This does not break the functionality. For browsers without `@property`, you can achieve transitions using a JavaScript `requestAnimationFrame` loop to interpolate the `--value`, though the native CSS transition is preferred for performance.
