---
name: complex-shapes
description: Clip elements and their content to any free-form shape, like a symbol, brush stroke, or organic texture for more expressive designs.
web-feature-ids:
  - masks
  - svg
sources:
  - https://developer.mozilla.org/docs/Web/CSS/Reference/Properties/mask
  - https://web.dev/articles/building/a-theme-switch-component
  - https://web.dev/articles/css-masking
  - https://web.dev/articles/how-we-built-designcember
  - https://web.dev/learn/css/paths-shapes-clipping-masking
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Masking/Introduction
  - https://css-tricks.com/clipping-masking-css/
  - https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/SVG_and_CSS
  - https://www.joshwcomeau.com/svg/friendly-introduction-to-svg/
  - https://css-tricks.com/svg-properties-and-css/
---

## Overview
To clip elements to complex, free-form shapes like brush strokes or organic textures, use CSS Masking (`mask-image`). While `clip-path` is excellent for geometric shapes or vector paths, `mask-image` allows you to use images (like PNGs with transparency) or SVGs to define the visible area of an element. This approach is more expressive because it supports semi-transparency, allowing for soft edges and complex textures that are difficult or impossible to achieve with `clip-path`.

## Implementation
To implement complex shapes using CSS masks:

### Using a raster image or SVG file
You can use the transparency of an image as a mask, with opaque parts visible and transparent parts hidden. This can be a PNG, SVG, or other image with transparency, or a generated image, like a CSS gradient.

```css
.shaped-element {
  /* MANDATORY: Use vendor prefix for wider support in older browsers */
  -webkit-mask-image: url('mask.png');
  -webkit-mask-size: cover; /* Scale mask to cover element */
  -webkit-mask-repeat: no-repeat; /* Do not tile the mask */

  /* Standard property for modern browsers */
  mask-image: url('mask.png');
  mask-size: cover;
  mask-repeat: no-repeat;
}
```

### Using an SVG element in HTML
You can also reference a `<mask>` element defined in an inline SVG in your page's HTML.

```html
<!-- White areas reveal content, black or transparent areas hide it -->
<svg width="0" height="0">
  <defs>
    <mask id="custom-shape">
      <!-- Use white shapes to define the mask -->
      <circle cx="50" cy="50" r="50" fill="white" />
    </mask>
  </defs>
</svg>

<div class="masked-content">
  <!-- Content to be masked -->
</div>

<style>
.masked-content {
  /* Reference the SVG mask ID */
  -webkit-mask-image: url(#custom-shape);
  mask-image: url(#custom-shape);
}
</style>
```

### Fallback strategies
{{ BASELINE_STATUS("masks") }}

If a browser does not support `mask-image` or the prefixed version:
- The element will not be clipped and will display as a normal rectangle.
- Ensure the content is still readable and the layout does not break without the mask (progressive enhancement).
- Optionally, use feature detection to provide a simpler fallback shape with `clip-path`.

```css
/* Fallback for browsers that support clip-path but not mask-image */
@supports not (mask-image: url(x)) and (clip-path: inset(0)) {
  .shaped-element {
    /* Use a simple rounded rectangle as fallback */
    clip-path: inset(5% round 15px);
  }
}
```
