---
name: progress-ring
description: Build a progress ring component that visually represents the completion status of a task or process, with support for content in the center and brand-consistent styling.
web-feature-ids:
  - progress
  - conic-gradients
  - masks
  - registered-custom-properties
---

# Overview

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
<div class="ring-wrapper">
  <progress value="75" max="100" aria-label="Task progress" class="progress-ring"></progress>
  <!-- Optional: Content to display in the center -->
  <div class="ring-content">
    75%
  </div>
</div>
```

### 2. Styles

#### Hiding Native UI
To style the `<progress>` element as a progress ring, first hide the default browser styling for progress bars.

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

#### Container and Ring

The wrapper provides the positioning context. The `<progress>` element handles the visual gradient.

```css
.progress-ring-wrapper {
  position: relative;
  display: grid;
  place-items: center;
}

progress.progress-ring {
  --size: 150px;
  --thickness: 16px;
  --track-color: #f1f5f9;
  --fill-color: #3b82f6;
  --value: attr(value type(<number>));
  width: var(--size);
  height: var(--size);

  transition: --value 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 50%;

  background: conic-gradient(
    var(--fill-color) calc(var(--value) * 1%),
    var(--track-color) 0
  );

  /* MANDATORY: Clip the background to the border-area. */
  background-clip: border-area;
  border: var(--thickness) solid transparent;
  background-origin: border-box;
}

.progress-ring-content {
  /* Positioned in the center of the wrapper */
  position: absolute;
}
```

You can also use a `radial-gradient` to make rounded end caps.

#### Enable smooth transitions with `@property`

To animate the progress ring smoothly when the value changes, register `--value` as a numeric custom property. 

Users with motion sensitivities may find the transition between values disorienting. Respect the `prefers-reduced-motion` media query by having a 0 second (immediate) duration by default, and setting a longer time for users with no preference.


```css
@property --value {
  syntax: '<number>';
  inherits: true;
  initial-value: 0;
}

progress.progress-ring {
  transition: --value 0s ease-in-out;
  @media (prefers-reduced-motion: no-preference) {
    transition-duration: 0.4s;
  }
}

```

### 3. Progress Updates

Update the `value` attribute on the `<progress>` element and the text content of `.progress-ring-content` (if displaying a percentage) whenever the value changes.

### 4. Optional Success State

You can use the CSS attribute selector to automatically update the ring's appearance (e.g., changing the color to green) when the task reaches completion.

```css
/* Change the fill color to green when the progress reaches 100% */
progress.progress-ring[value="100"] {
  --fill-color: #10b981;
}
```

## Fallback strategies

Do not add a fallback value inside the `<progress>` element. It is not used by assistive technology and ignored by all modern browsers.

#### Animation fallback

{{ FEATURE_FALLBACKS("registered-custom-properties") }}

If `@property` is not supported, the ring will jump to the new value instantly instead of transitioning smoothly. In most cases this is fine, and does not break any functionality.

If the transition is absolutely necessary, you can check for `@property` support and use a `requestAnimationFrame()` loop to interpolate `--value` in older browsers.

{{ FEATURE_FALLBACKS("background-clip-border-area") }}

For browsers that don't yet support `background-clip: border-area`, fall back to a `mask-image` to hollow out the center of the `<progress>` element.

```css
@supports not (background-clip: border-area) {
  mask-image: radial-gradient(
    transparent calc(50% - var(--thickness)),
    black calc(50% - var(--thickness) + 0.5px)
  );
  border: 0;
}
```

{{ FEATURE_FALLBACKS("attr") }}

For browsers that don't support the `attr()` CSS function for any property, use a `MutationObserver` to automatically sync the `value` attribute to the `--value` custom property.

```js
if (!CSS.supports("width: attr(value type(<number>))")) {
  const observer = new MutationObserver(() => {
    progress.style.setProperty("--value", progress.getAttribute("value"));
  });
  observer.observe(progress, {
    attributes: true,
    attributeFilter: ["value"],
  });
}
```