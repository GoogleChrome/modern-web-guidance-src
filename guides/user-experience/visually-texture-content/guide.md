---
name: visually-texture-content
description: Apply realistic weathering and texture patterns to elements to give them an organic, aged, or physical material appearance.
web-feature-ids:
  - masks
sources:
  - https://developer.mozilla.org/docs/Web/CSS/Reference/Properties/mask
  - https://web.dev/articles/css-masking
  - https://web.dev/learn/css/paths-shapes-clipping-masking
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Masking/Introduction
  - https://css-tricks.com/clipping-masking-css/
---

## Overview
To apply realistic weathering or texture patterns (like grunge, noise, or paper texture) to an element, use CSS Masking (`mask-image`) with a repeating texture image. This allows you to make the content itself appear textured by making parts of it semi-transparent, rather than just overlaying a texture on top. This creates a more realistic physical material appearance.

## Implementation
To apply a texture pattern:

### Method 1: Using a repeating raster image (Recommended for realistic textures)
This is the most common method for realistic textures.

```css
.weathered-element {
  /* MANDATORY: Use vendor prefix for wider support in older browsers */
  -webkit-mask-image: url('grunge-pattern.png');
  -webkit-mask-repeat: repeat; /* Repeat the pattern to fill the area */
  -webkit-mask-size: 300px; /* Control the scale of the texture */

  /* Standard property for modern browsers */
  mask-image: url('grunge-pattern.png');
  mask-repeat: repeat;
  mask-size: 300px;
}
```

### Method 2: Using CSS Gradients for geometric patterns
You can generate patterns using CSS gradients. This is self-contained and does not require external image files.

```css
.patterned-element {
  --checkerboard-gradient: 
    linear-gradient(45deg, #000 25%, transparent 25%), 
    linear-gradient(-45deg, #000 25%, transparent 25%), 
    linear-gradient(45deg, transparent 75%, #000 75%), 
    linear-gradient(-45deg, transparent 75%, #000 75%);

  /* Apply a checkerboard pattern as a mask */
  -webkit-mask-image: var(--checkerboard-gradient);
  -webkit-mask-size: 20px 20px;
  -webkit-mask-position: 0 0, 0 10px, 10px -10px, -10px 0px;
  
  mask-image: var(--checkerboard-gradient);
  mask-size: 20px 20px;
  mask-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}
```

## Fallback strategies
{{ BASELINE_STATUS("masks") }}

If a browser does not support `mask-image` or the prefixed version:
- The element will display without the texture (clean and solid fill).
- Ensure the content is still readable without the texture (progressive enhancement).
- You can use a background image or an overlay as a fallback to simulate the texture, although it will not affect the transparency of the content itself.

```css
/* Fallback: Use a background image for browsers without mask support */
@supports (not (mask-image: url(x))) and (not (-webkit-mask-image: url(x))) {
  .weathered-element {
    /* Fallback adds texture on top or behind, depending on implementation */
    background-image: url('grunge-pattern.svg');
    background-color: #fff; /* Ensure background is solid if needed */
  }
}
```
