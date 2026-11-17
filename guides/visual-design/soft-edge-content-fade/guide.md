---
name: soft-edge-content-fade
description: Apply a transparency gradient to content edges to indicate further scrollable areas or to obscure payment-walled text.
web-feature-ids:
  - masks
---

# Soft Edge Content Fade

## Overview
To apply a transparency gradient to the edges of a container (e.g., to indicate more content is available to scroll or to fade out text), use CSS Masking with a linear gradient. This approach is superior to using a semi-transparent overlay because it actually fades the content itself, allowing the background to show through naturally without interfering with text selection or pointer events.

## Implementation
To implement a soft edge fade:

### Fading the bottom edge of a container
This is useful for indicating that there is more content below in a scrollable area.

The mask stays fixed to the container while the content scrolls, so give the fade a fixed length and add the same amount of padding at the end of the container. The last lines can then scroll clear of the fade and be read at full contrast (WCAG 1.4.3 Contrast (Minimum)). This only applies to containers that scroll: when the fade marks content that is withheld on purpose, such as a paywall teaser with `overflow: hidden`, the faded text isn't meant to be read, so a fixed percentage-based fade is fine.

```css
.container {
  /* Enable scrolling */
  overflow-y: auto;

  /* Same length as the fade, so the last lines can scroll clear of it */
  padding-block-end: 3em;
  
  /* MANDATORY: Use vendor prefix for wider support in older browsers */
  -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 3em), transparent 100%);
  
  /* Standard property for modern browsers */
  mask-image: linear-gradient(to bottom, black calc(100% - 3em), transparent 100%);
}
```

### Fading both top and bottom edges
You can use a single gradient with multiple color stops to fade both edges.

```css
.dual-fade-container {
  /* Same length as the fades, so the first and last lines can scroll clear of them */
  padding-block: 3em;

  /* Content is fully visible except within 3em of the top and bottom edges */
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 3em, black calc(100% - 3em), transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, black 3em, black calc(100% - 3em), transparent 100%);
}
```

## Fallback strategies
{{ BASELINE_STATUS("masks") }}

If a browser does not support `mask-image` or the prefixed version:
- The content will not fade and will display with sharp edges.
- Ensure the interface is still functional and content is readable without the fade (progressive enhancement).
- You can use a semi-transparent overlay as a fallback, but be aware it requires knowing the background color and may interfere with text selection unless `pointer-events: none` is used.

```css
/* Fallback using an overlay for browsers that do not support masking */
@supports (not (mask-image: linear-gradient(to bottom, black, transparent))) and (not (-webkit-mask-image: linear-gradient(to bottom, black, transparent))) {
  .container {
    position: relative;
  }
  
  .container::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 20%;
    /* Fallback assumes a solid background color (e.g., white) */
    background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,1));
    pointer-events: none; /* Allow interaction with text underneath */
  }
}
```
