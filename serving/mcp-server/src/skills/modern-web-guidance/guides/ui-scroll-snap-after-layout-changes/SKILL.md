---
description: Ensure smooth scrolling experiences by preventing scroll snapping issues after layout changes.
filename: scroll-snap-after-layout-changes
category: ui
---

# Scroll snapping after layout changes

This article covers a new feature in Chrome 81 that preserves scroll snap positions even when the page layout changes, eliminating the need for JavaScript workarounds.

## Best Practices

*   **DO** leverage the built-in support for scroll snapping after layout changes in Chrome 81 and later. This eliminates the need for JavaScript event listeners to force re-snapping.
*   **DO** understand that scroll snapping helps create well-controlled scroll experiences by aligning scrollable content with its container, preventing awkward scroll positions and creating a paging effect.
*   **DO** consider scroll snapping for use cases like paginated articles and image carousels.
*   **DO** be aware that snapping also executes when the page loads, which can affect the initial scroll offset of scrollers.
*   **DON'T** rely on JavaScript workarounds like `scroller.scrollBy(0,0)` to force re-snapping after layout changes, as this can be ineffective and may not snap to the same element as before.

## Interoperability

While Chrome 81+ supports scroll snapping after layout changes natively, other browsers may require workarounds or have open tickets for similar functionality. Check [Can I use CSS Scroll Snap?](https://caniuse.com/#feat=css-snappoints) for current browser support.

## Example: Sticky scrollbars

With native support for re-snapping after layout changes, developers can implement sticky scrollbars with minimal CSS:

```css
.container {
  scroll-snap-type: y proximity;
}

.container::after {
  scroll-snap-align: end;
  display: block;
}
```

This example demonstrates how adding a new message can trigger a re-snap, making it stick to the bottom in Chrome 81. For a live demo, see the [demo chat UI](https://codepen.io/argyleink/pen/RwPWqKe).

## Future Work

Future development may include support for smooth scrolling effects during re-snapping. Keep an eye on the [specification issue](https://github.com/w3c/csswg-drafts/issues/4609) for updates.