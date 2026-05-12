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

1. **Determine the Element Type**: For non-replaced elements (e.g., `<div>`, `<section>`), setting `overflow: clip` is **mandatory** to enable extended margin control.
2. **Apply `overflow: clip`**: Ensure the target container has `overflow: clip` enabled to allow `overflow-clip-margin` to take effect. This value clips content to the padding box by default and prevents all scrolling (both user-initiated and programmatic).
3. **Define the clipping margin**: Use `overflow-clip-margin` to extend the boundary.
4. **Specify by length**: Use a length value (e.g., `20px`) to expand the clipping box by that amount.
5. **Specify by box edge**: Use keywords like `content-box`, `padding-box`, or `border-box` to align the clip to specific box edges.

## Example Code: Controlled Clipping on Non-Replaced Containers

```css
/**
 * Base Box Styles demonstrating core clipping fallback progression.
 * For non-replaced elements, declaring `overflow: clip` is MANDATORY to enable margin control.
 */
.box {
  border: 5px solid #333;
  width: 200px;
  height: 100px;
  padding: var(--box-padding);
  box-sizing: content-box;
  position: relative;
  background: #fff;
  /* Level 1 Fallback: Baseline */
  overflow: hidden;
}

@supports (overflow: clip) {
  .box {
    /* Level 2: Modern Baseline (Safari 16+) */
    overflow: clip;
  }
}

/**
 * Target container variant applying an extended clipping margin.
 * Demonstrates modern support overrides paired with manual (fallback) clip-path simulation.
 */
.clip-20px {
  overflow: visible;
  clip-path: inset(-20px);
}

@supports (overflow-clip-margin: 20px) {
  .clip-20px {
    /* MANDATORY: overflow must be 'clip' for margin to work on non-replaced elements */
    overflow: clip;
    overflow-clip-margin: 20px;
    clip-path: none;
  }
}
```

## Strategic Implementation & Best Practices

- **DO** use `overflow: clip` when you want to ensure content is strictly contained on target containers, as it is **mandatory** for `overflow-clip-margin` to take effect.
- **DO** use `overflow-clip-margin` to allow small visual elements (like box shadows or decorative elements) to overflow slightly without triggering scrollbars or being cut off abruptly.
- **DO NOT** use `overflow: scroll` or `overflow: auto` on target containers when the intent is to strictly clip content without scrolling.
- **DO** account for the **Precedence Hierarchy**: If `overflow-clip-margin` is specified along with `overflow: hidden`, the margin is ignored.

## Fallback Strategy

{{ BASELINE_STATUS("overflow-clip-margin") }}

For browsers that do not support `overflow: clip`, the standard fallback is `overflow: hidden`, which clips content to the padding box but permits programmatic scrolling. 

Using `clip-path: inset()` is the most powerful way to simulate `overflow-clip-margin` for older browsers because it allows you to define exactly where the cut-off boundary is located. To make this work as a fallback, set `overflow: visible` on the container (so browsers do not preemptively clip at the padding box) and use `clip-path` to perform the clipping manually. Modern browsers can then override these styles using `@supports`.

To implement a complete fallback experience:
1. **Simulate margins via `clip-path`**: Author base rules using `clip-path: inset()` to simulate precise box edges or length margins, paired with `overflow: visible`.
2. **Create notification banners**: Add specific banners to inform users when fallback clipping or margin simulations are active.
3. **Feature detect with JavaScript**: Use `CSS.supports()` to verify native support, conditionally displaying notification banners and applying core fallback classes as needed.

```css
/* Overflow Clip Fallback */
.box {
  padding: var(--box-padding);
  overflow: hidden; 
}

/* Applied for browsers with overflow: clip support */
@supports (overflow: clip) {
  .box {
    overflow: clip;
  }
}

/* 2. Content-Box Fallback */
.clip-content {
  overflow: visible; 
  clip-path: inset(calc(var(--box-padding) + 5px)); 
}

/* Applied for browsers with overflow-clip-margin support */
@supports (overflow-clip-margin: content-box) {
  .clip-content {
    overflow: clip;
    overflow-clip-margin: content-box;
    clip-path: none;
  }
}
```

```javascript
/**
 * Progressive Enhancement Fallback
 */
document.addEventListener("DOMContentLoaded", () => {
  // Check for native support of overflow: clip
  if (!CSS.supports("overflow", "clip")) {
    const banner = document.getElementById('fallback-banner');
    if (banner) banner.style.display = 'block';
  }

  // Check for native support of overflow-clip-margin
  if (!CSS.supports("overflow-clip-margin", "content-box")) {
    const marginBanner = document.getElementById('margin-fallback-banner');
    if (marginBanner) marginBanner.style.display = 'block';
  }
});
```