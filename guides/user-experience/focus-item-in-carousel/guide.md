---
name: focus-item-in-carousel
description: Build a scrollable carousel that centers on a specific image or other visual components in the viewport on initial page load.
web-feature-ids:
  - scroll-initial-target
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target
  - https://github.com/DavMila/explainer-scroll-initial-target
  - https://chromestatus.com/feature/6276178888097792
  - https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target
  - https://webstatus.dev/features/scroll-initial-target
---
# Focus Item in Carousel

The CSS property `scroll-initial-target` offers a declarative CSS-only way to bring a specific child element into the visible area of its scroll container as soon as the container is rendered. Previously, developers heavily relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#item-id`) to scroll a carousel container to a specific item on initial load.

## How to implement

The `scroll-initial-target` property allows you to declaratively set which child element should be scrolled into view when a scroll container is first displayed.

To implement this:
1. Ensure the parent element is a scroll container with scroll snapping (e.g., `overflow-x: auto` and `scroll-snap-type: x mandatory`).
2. Apply `scroll-snap-align` (e.g., `center`) to the child elements.
3. Apply `scroll-initial-target: nearest` to the specific child element you want to snap into view.

When multiple elements specify an initial target within the same container, the user agent selects the one which comes first in the tree order. Once the user manually scrolls or an explicit programmatic scroll is triggered, the initial target isn't active anymore and the scroll container can be freely scrolled.

## Example code

```css
/**  
 * PARENT: The main scroll container.
 * Includes mandatory scroll snap on parent.
 */
.carousel {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
}

/** 
 * Holds scroll snap alignment.
 */
.item {
  scroll-snap-align: center;
}

/** 
 * TARGET: Focused item
 * The specific item to focus on initial render.
 */
.item.target {
  scroll-initial-target: nearest;
}
```
## Strategic implementation

- **DO** use `scroll-initial-target: nearest` when you want to draw the user's attention to a specific part of a scrollable area upon load (e.g., automatically scrolling a plant gallery to feature the "Monstera Deliciosa").
- **DO NOT** use this as a replacement for standard accessibility focus. This property only affects the visual scroll position; it does not move keyboard focus.
- **DO NOT** use it if you need to animate the scroll position on load; this property sets the *initial* position instantly.
- **DO** understand that the property is only effective on the *initial* render or when the scroll container's content changes significantly.
- **DO** note that it will not override fragment navigation (if a URL has a `#hash` identifier it takes precedence).

## Fallback strategies

For browsers that have yet to support `scroll-initial-target`, leverage `scrollIntoView()` as a fallback for cross-browser compatibility. Note that for a horizontal carousel, you typically want to center the item inline.

```javascript
document.addEventListener("DOMContentLoaded", () => {
  const targetItem = document.querySelector('.item.target');

  if (targetItem && !CSS.supports('scroll-initial-target', 'nearest')) {
    // Fallback for browsers that don't support the CSS property
    targetItem.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });
  }
});
```

You can leave the default scroll position as a safe fallback for progressive enhancement if the specific target content isn't critical for the initial view.