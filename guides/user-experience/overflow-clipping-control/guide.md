---
name: overflow-clipping-control
description: Adjust the visible clipping boundary of an element to align with the content edge, padding edge, or border edge—or a specified offset from any of these—offering finer-grained control over how content is clipped.
web-feature-ids:
  - overflow-clip
  - overflow-clip-margin
sources:
  - https://developer.chrome.com/en/blog/overflow-replaced-elements
  - https://web.dev/en/learn/css/overflow
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow-clip-margin
  - https://css-tricks.com/almanac/properties/o/overflow-clip-margin/
---

# Overflow Clipping Control

Overflow clipping control allows developers to fine-tune how content is clipped when it exceeds the bounds of its container. By using `overflow: clip` and `overflow-clip-margin`, you can specify exactly where the clipping occurs and even extend the clipping boundary beyond the element's box.

This pattern is particularly useful for preventing unwanted overflow on replaced elements (like images and videos) and for allowing visual effects like box shadows to bleed slightly outside a clipped container without triggering scrollbars.

## How to Implement

1. **Determine the Element Type**:
   - **Non-Replaced Elements** (e.g., `<div>`, `<section>`): Setting `overflow: clip` is **mandatory** to enable extended margin control.
   - **Replaced Elements** (e.g., `<img>`, `<video>`): In modern browsers, replaced elements default to `overflow: clip`, making the declaration **optional** but recommended for explicit code intent.
2. **Apply `overflow: clip` (if applicable)**: Ensure the target element has `overflow: clip` enabled to allow `overflow-clip-margin` to take effect. This value clips content to the padding box by default and prevents all scrolling (both user-initiated and programmatic).
3. **Define the clipping margin**: Use `overflow-clip-margin` to extend the boundary.
4. **Specify by length**: Use a length value (e.g., `20px`) to expand the clipping box by that amount.
5. **Specify by box edge**: Use keywords like `content-box`, `padding-box`, or `border-box` to align the clip to specific box edges. This is especially relevant for replaced elements like `<img>` which default to `content-box` clipping in modern browsers.

## Example Code: Controlled Image Clipping

```css
/**
 * Container with clip margin to allow some overflow.
 * For this non-replaced element, declaring `overflow: clip` is MANDATORY.
 */
.box {
  width: 200px;
  height: 200px;
  padding: 20px;
  border: 5px solid #333;
  
  /* MANDATORY: overflow must be 'clip' for margin to work on non-replaced elements */
  overflow: clip;
  
  /* Extend the clipping boundary 10px beyond the padding box */
  overflow-clip-margin: 10px;
}

/**
 * Replaced element respecting overflow.
 * Modern browsers default to content-box clipping for images.
 * For this replaced element, declaring `overflow: clip` is OPTIONAL.
 */
.demo-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  
  /* OPTIONAL: Modern browsers default to overflow: clip for images */
  overflow: clip;
  
  /* Override default content-box clip if needed */
  overflow-clip-margin: padding-box;
}
```

## Strategic Implementation & Best Practices

- **DO** use `overflow: clip` when you want to ensure content is strictly contained on non-replaced elements, as it is **mandatory** for `overflow-clip-margin` to take effect.
- **DO** remember that replaced elements default to `overflow: clip`, so declaring it explicitly is **optional** but recommended for cross-browser consistency and readability.
- **DO** use `overflow-clip-margin` to allow small visual elements (like box shadows or decorative elements) to overflow slightly without triggering scrollbars or being cut off abruptly.
- **DO NOT** assume that setting `overflow: visible` on replaced elements like `<img>` will always behave as it did prior to Chrome 108. It may cause unexpected layout shifts if the image aspect ratio doesn't match the container.
- **DO NOT** use `overflow: scroll` or `overflow: auto` on the target containers when the intent is to strictly clip content without scrolling.
- **DO** account for the **Precedence Hierarchy**: If `overflow-clip-margin` is specified along with `overflow: hidden`, the margin is ignored.

## Fallback Strategy

{{ BASELINE_STATUS("overflow-clip-margin") }}

For browsers that do not support `overflow: clip` or `overflow-clip-margin`, the standard fallback is `overflow: hidden`. This clips the content to the padding box but allows programmatic scrolling.

To implement a complete fallback experience:
1. **Provide a fallback class**: Define a class that applies `overflow: hidden !important` to override the modern styles.
2. **Create a notification banner**: Add a banner to inform the user that a fallback is active.
3. **Feature detect with JavaScript**: Use `CSS.supports('overflow', 'clip')` to detect support and apply the fallback class and show the banner if unsupported.

```css
.box {
  /* Base property for modern browsers */
  overflow: clip;
  overflow-clip-margin: 20px;
}

/* Fallback class for non-supporting browsers */
.overflow-fallback {
  overflow: hidden !important;
}
```

```javascript
/**
 * Progressive Enhancement Fallback
 */
document.addEventListener("DOMContentLoaded", () => {
  // Check for native CSS support
  if (!CSS.supports("overflow", "clip")) {
    // Show fallback banner if it exists
    const banner = document.getElementById('fallback-banner');
    if (banner) {
      banner.style.display = 'block';
    }
    
    // Apply fallback class to target containers
    const boxes = document.querySelectorAll('.box');
    boxes.forEach(box => {
      box.classList.add('overflow-fallback');
    });
  }
});
```
