---
description: Create tooltips and other anchored UI elements that adapt to available space by positioning them relative to an anchor element.
filename: anchor-positioning-tooltips
category: ui
---

# Anchor Positioning for Tooltips

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning
- https://web.dev/articles/css-anchor-positioning

## Best Practices

Use CSS Anchor Positioning to reliably position elements like tooltips, menus, and dialogs relative to other elements on the page. This ensures that UI elements stay connected to their anchors and adapt to different screen sizes and layouts.

```css
.anchor-element {
  anchor-name: --my-anchor;
}

.positioned-element {
  position-anchor: --my-anchor;
  /* Position the element above the anchor, centered */
  inset-area: top center;
  /* Use fallbacks to automatically adjust position if there isn't enough space */
  position-try-options: flip-block flip-inline;
}
```

```html
<div class="anchor-element">Hover or interact here</div>

<div class="positioned-element">
  This is the tooltip content.
</div>
```

## Fallback strategies

If the user's browser does not support CSS Anchor Positioning, the following fallback strategies MUST be used.

### Anchor Positioning

- **DO** use `@supports (anchor-name: --foo)` for CSS feature detection.
- **DO** use `if ("positionAnchor" in document.documentElement.style)` for JavaScript feature detection.
- **DO** conditionally load the polyfill if and only if the browser fails the feature detection check.
- **DO** download a local copy of the polyfill at https://unpkg.com/@oddbird/css-anchor-positioning@0.8.0/dist/css-anchor-positioning.js or `npm install @oddbird/css-anchor-positioning`.