---
name: focus-chat-message
description: Build a chat message feature that can display a conversation automatically scrolled to a specific message (e.g. matching a search query) on initial render.
web-feature-ids:
  - scroll-initial-target
  - scroll-into-view
  - scroll-snap
---

# Focus Chat Message

The CSS property `scroll-initial-target` offers a declarative CSS-only way to bring a specific child element into the visible area of its scroll container as soon as the container is rendered. Previously, developers heavily relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#message-id`) to scroll a chat container to a specific message on initial load.

## How to implement

The `scroll-initial-target` property allows you to declaratively set which child element should be scrolled into view when a scroll container is first displayed.

To implement this:
1. Ensure the parent element is a scroll container with scroll snapping (e.g., `overflow-y: auto` and `scroll-snap-type: y mandatory`).
2. Apply `scroll-snap-align` (e.g., `start`) to the child elements.
3. Apply `scroll-initial-target: nearest` to the specific child element you want to snap into view.

When multiple elements specify an initial target within the same container, the user agent selects the one which comes first in the tree order. Once the user manually scrolls or an explicit programmatic scroll is triggered, the initial target isn't active anymore and the scroll container can be freely scrolled.

## Example code

```css
/**  
 * PARENT: The main scroll container.
 * Includes mandatory scroll snap on parent.
 */
.chat-container {
  height: 400px;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
}

/** 
 * Holds scroll snap alignment.
 */
.message {
  scroll-snap-align: start;
}

/** 
 * TARGET: The focused item.
 */
.message.target {
  scroll-initial-target: nearest;
}
```

## Strategic implementation

- **DO** use `scroll-initial-target: nearest` when you want to draw the user's attention to a specific part of a scrollable area upon load (e.g., highlighting a search result within a chat log).
- **DO NOT** use this as a replacement for standard accessibility focus. This property only affects the visual scroll position; it does not move keyboard focus.
- **DO NOT** use it if you need to animate the scroll position on load; this property sets the *initial* position instantly.
- **DO** understand that the property is only effective on the *initial* render or when the scroll container's content changes significantly.
- **DO** note that it will not override fragment navigation (if a URL has a `#hash` identifier it takes precedence).

## Fallback strategies

For browsers that have yet to support `scroll-initial-target`, leverage `scrollIntoView()` as a fallback for cross-browser compatibility.

```javascript
document.addEventListener("DOMContentLoaded", () => {
  const targetMessage = document.querySelector('.message.target');

  if (targetMessage && !CSS.supports('scroll-initial-target', 'nearest')) {
    // Fallback for browsers that don't support the CSS property
    targetMessage.scrollIntoView({ behavior: 'instant', block: 'nearest' });
  }
});
```

You can leave the default scroll position as a safe fallback for progressive enhancement if the specific target content isn't critical for the initial view.

## References

- [MDN: scroll-initial-target](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target)
- [scroll-initial-target GitHub Explainer](https://github.com/DavMila/explainer-scroll-initial-target)
- [Chrome Platform Status](https://chromestatus.com/feature/6276178888097792)
- [CSS Scroll Snap Module Level 2](https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target)
- [Web Platform Status](https://webstatus.dev/features/scroll-initial-target)