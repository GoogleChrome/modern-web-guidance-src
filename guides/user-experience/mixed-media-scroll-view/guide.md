---
name: mixed-media-scroll-view
description: Build a single scrollable feed with mixed media and text that automatically renders with a specific media item scrolled into view.
web-feature-ids:
  - scroll-initial-target
  - scroll-into-view
  - scroll-snap
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target
  - https://github.com/DavMila/explainer-scroll-initial-target
  - https://chromestatus.com/feature/6276178888097792
  - https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target
  - https://webstatus.dev/features/scroll-initial-target
---

# Mixed Media Scroll View

The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific child element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#item-id`) to position a feed—both of which can cause layout shifts or conflict with user navigation.

## How to Implement

The `scroll-initial-target` property allows you to set which child element should be the starting point of a scroll container. This is particularly effective for mixed-media feeds where content height is unpredictable.

To implement this successfully:

1.  **Define the Container:** Ensure the parent element is a scroll container. You do not need to enforce `scroll-snap-type` if you want users to scroll freely after the initial load.
2.  **Target the Item:** Apply `scroll-initial-target: nearest` to the specific child element you want to bring into view. You do not need to apply `scroll-snap-align` to the feed items, allowing the scrolling experience to remain smooth and native without forced snapping.

> **The "First-Wins" Rule:** If multiple elements within the same container specify `nearest`, the browser selects the one that appears first in the DOM tree order.

## Example Code: Vertical Media Feed

In this example, the feed starts focused on a specific "featured" item rather than the very top of the list.

```css
/** 
 * TARGET: The item that should be visible on initial load.
 */
.item.target {
  scroll-initial-target: nearest;
}
```

## Strategic Implementation & Best Practices

- **DO** use `scroll-initial-target` for "middle-start" experiences, such as a calendar starting on the current day or a gallery starting on a specific image.
- **DO NOT** confuse this with accessibility focus. This property only moves the **visual** viewport; it does not move the keyboard focus. You must manually manage `element.focus()` if the target is intended to be the starting point for keyboard users.
- **DO NOT** use this if you need a smooth "scrolling" animation on load; this property is discrete and sets the position instantly during the layout phase.
- **DO** account for the **Precedence Hierarchy**: A URL fragment (e.g., `example.com/#top`) and the container-level `scroll-start` property both take precedence over `scroll-initial-target`.
- **DO** provide dimensions for media. Since the scroll position is calculated during initial layout, ensure images or videos have `aspect-ratio` or fixed `height`/`width` to prevent the target from shifting after the media loads.

## Fallback Strategy

For browsers that do not yet support the API, use a JavaScript fallback. For feeds containing images or mixed media, use the `window.load` event to ensure the browser has calculated the full height of all elements before triggering the scroll.

```javascript
/**
 * Progressive Enhancement Fallback
 */
document.addEventListener("DOMContentLoaded", () => {
  // Check for native CSS support
  if (!CSS.supports("scroll-initial-target", "nearest")) {
    setTimeout(() => {
      const feedTarget = document.querySelector(".item.target");

      if (feedTarget) {
        // 'block: center' ensures the featured media is centered in view
        feedTarget.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    }, 50); // delay ensures layout metrics and images are fully resolved
  }
});
```

Leave the default scroll position as a safe fallback for progressive enhancement if the specific target content isn't critical for the initial view.
