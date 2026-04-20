---
name: stencil-cutouts
description: Combine multiple shapes to create complex cutouts or 'knockout' effects in elements, such as adding a notch to an element.
web-feature-ids:
  - masks
sources:
  - https://developer.mozilla.org/docs/Web/CSS/Reference/Properties/mask
  - https://web.dev/articles/building/a-theme-switch-component
  - https://web.dev/articles/css-masking
  - https://web.dev/articles/how-we-built-designcember
  - https://web.dev/learn/css/paths-shapes-clipping-masking
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Masking/Introduction
  - https://css-tricks.com/clipping-masking-css/
---

## Overview
To create complex cutouts or "knockout" effects (like adding a notch to a card or creating a stencil effect with a hole), use CSS Masking. The most robust and widely supported method for complex cutouts is using an SVG mask, where you can combine shapes using standard SVG elements. For simpler cutouts, like a circular hole or a simple notch, you can use a CSS gradient that includes transparent areas.

## Implementation
To implement stencil cutouts:

### Using an SVG Mask (Recommended for complex cutouts)
SVG masks allow you to define shapes that subtract from or add to the visible area using white (reveal) and black (hide) fills.

```html
<!-- Define the mask in SVG -->
<svg width="0" height="0">
  <defs>
    <!-- Use objectBoundingBox to make the mask scale with the element -->
    <mask id="notch-stencil" maskContentUnits="objectBoundingBox">
      <!-- Fill the entire area with white (fully visible) -->
      <rect width="1" height="1" fill="white" />
      <!-- Draw a black circle at the top center to cut it out -->
      <circle cx="0.5" cy="0" r="0.1" fill="black" />
    </mask>
  </defs>
</svg>

<div class="notched-card">
  <!-- Content -->
</div>

<style>
.notched-card {
  /* Reference the SVG mask */
  -webkit-mask-image: url(#notch-stencil);
  mask-image: url(#notch-stencil);
}
</style>
```

### Using a single CSS Gradient for simple cutouts
You can create simple cutouts using a gradient that goes from transparent to opaque.

```css
.hole-cutout {
  /* Create a transparent circular hole in the center */
  -webkit-mask-image: radial-gradient(circle at center, transparent 30%, black 31%);
  mask-image: radial-gradient(circle at center, transparent 30%, black 31%);
}
```

## Fallback strategies
{{ BASELINE_STATUS("masks") }}

If a browser does not support `mask-image` or the prefixed version:
- The element will not have the cutout and will display as a solid shape.
- Ensure the content is still readable and the layout does not break without the cutout (progressive enhancement).
- For critical UI shapes, consider using an inline SVG instead of CSS masking to ensure the shape is rendered correctly in all browsers.

```css
/* Fallback: Ensure content is visible even if mask fails */
.notched-card {
  background-color: #f0f0f0; /* Fallback background */
}
```
