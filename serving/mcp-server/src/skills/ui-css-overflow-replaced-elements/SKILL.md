---
description: Prevent unwanted visual overflow in replaced elements by correctly applying the CSS overflow property.
filename: css-overflow-replaced-elements
category: ui
---

# Prevent Unwanted Overflow on Replaced Elements

From Chrome 108, replaced elements like `<img>`, `<video>`, and `<canvas>` now respect the `overflow` CSS property. Previously, this property was ignored, meaning these elements would always clip content to their content box. This change might lead to unexpected visual overflow if your stylesheets were relying on the old behavior, especially when combined with properties like `object-fit` or `border-radius`.

## Best Practices

Ensure that your CSS correctly handles the `overflow` property for replaced elements to prevent unintended visual glitches.

If you encounter unwanted overflow, inspect the element's CSS using browser DevTools. Identify any CSS declarations that might be setting `overflow` to `visible` and either remove them if they are unintentional or update them to `overflow: clip;` to restore the previous clipping behavior.

```css
img {
  overflow: clip; /* Explicitly clip overflow */
}
```

If modifying the main stylesheet is complex, you can apply an inline style with higher specificity:

```html
<img style="overflow: clip !important;" src="your-image.jpg" alt="Description">
```

Consider the interaction between `overflow`, `object-fit`, and `border-radius`. For example, using `object-fit: cover` with `overflow: visible` can cause parts of the image to extend beyond the element's box. Similarly, `border-radius: 50%` combined with `overflow: visible` will no longer clip the image into a circle, potentially showing parts of the image outside the intended circular area.

If your intention is for these elements to *not* clip their overflow, ensure `overflow: visible;` is explicitly set and that you understand the visual implications.

A case where `all: inherit;` could unintentionally affect overflow:

```css
img {
  all: inherit; /* This will inherit overflow from its parent if set */
}
```

In such cases, explicitly setting `overflow: clip;` on the `img` element is the most straightforward solution to ensure consistent clipping.