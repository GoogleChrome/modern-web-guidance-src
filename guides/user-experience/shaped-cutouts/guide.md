---
name: shaped-cutouts
description: Combine multiple shapes to create complex cutouts or 'knockout' effects in elements, such as adding a notch to an element.
web-feature-ids:
  - masks
sources:
  - https://developer.mozilla.org/docs/Web/CSS/Reference/Properties/mask
  - https://web.dev/articles/building/a-theme-switch-component
  - https://web.dev/articles/css-masking
  - https://web.dev/learn/css/paths-shapes-clipping-masking
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Masking/Introduction
  - https://css-tricks.com/clipping-masking-css/
---

## Overview
To create complex cutouts or "knockout" effects (like adding a notch to a card or creating a shaped border), use CSS Masking. For complex cutouts, use an SVG mask, where you can create a mask by combining shapes using standard SVG elements. For simpler cutouts, like a circular hole or a simple notch, you can use a CSS gradient that includes transparent areas.

## Implementation
To implement shaped cutouts:

### Using an SVG Mask (Recommended for complex cutouts)
SVG masks allow you to define shapes that subtract from or add to the visible area using white (reveal) and black (hide) fills.

> **Important**: Always apply the mask to a background layer (like a `::before` pseudo-element) rather than the parent element containing text. This ensures that if the mask fails to load or is unsupported, your text content is never clipped, lost, or rendered unreadable.

Using **absolute positioning** with a negative `z-index` allows you to stack the text content on top of the background pseudo-element cleanly:

```html
<!-- Define the mask in SVG (hidden from view) -->
<svg width="0" height="0" style="position: absolute;">
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
  <h2>Card Title</h2>
  <p>Card content here.</p>
</div>

<style>
.notched-card {
  position: relative;
  color: white;
  padding: 20px;
  z-index: 1;
}

/* The mask is applied to an absolute positioned pseudo-element stacked behind content */
.notched-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #3498db;
  z-index: -1;

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
- The background pseudo-element will display as a normal solid rectangle without the cutout.
- By applying the mask to a `::before` pseudo-element instead of the text container, the text remains fully readable and styled, avoiding any contrast issues.
- The layout degrades gracefully to a standard card design without breaking.
