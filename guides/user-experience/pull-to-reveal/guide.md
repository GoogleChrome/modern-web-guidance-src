---
name: pull-to-reveal
description: Build a pull-to-reveal feature that would enable the user to pull down on the screen to reveal more content, like a search bar.
web-feature-ids:
  - scroll-initial-target
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target
  - https://github.com/DavMila/explainer-scroll-initial-target
  - https://chromestatus.com/feature/6276178888097792
  - https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target
  - https://webstatus.dev/features/scroll-initial-target
---

# Pull to Reveal

The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific descendant element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#content-id`) to hide a top search bar or refresh control on initial load, forcing the user to scroll up (pull down) to reveal it.

## How to Implement

The `scroll-initial-target` property allows you to declaratively set which descendant element should be scrolled into view when a scroll container is first displayed.

To implement this successfully:

1.  **Define the Container:** The ancestor element must be a scroll container and can optionally add `scroll-snap-type`.
2.  **Set Alignment (Required):** Apply `scroll-snap-align` (e.g., `start`) to the descendant elements. **Note:** If the descendant's alignment is `none` (the default), `scroll-initial-target` will not function because the browser has no reference point for positioning.
3.  **Target the Item:** Apply `scroll-initial-target: nearest` to the specific descendant element you want to snap into view.

> **The "First-Wins" Rule:** If multiple elements within the same container specify `nearest`, the browser selects the one that appears first in the DOM tree order.

## Example Code: Pull to Reveal Search

```css
/**  
 * ANCESTOR: Define the scroll container and
 * enable snapping for subsequent user scrolls.
 */
.scroll-container {
  height: 100vh;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
}

/** 
 * descendantS: Both the search bar and the main content need snap alignment.
 * The main content aligns to start to serve as the initial target position
 * and to act as a valid snap point after scrolling.
 */
.main-content {
  scroll-snap-align: start;
}

/** 
 * TARGET: The item that should be visible on initial load.
 */
.main-content.target {
  scroll-initial-target: nearest;
}

/**
 * HIDDEN ELEMENT:
 * The element we want to hide on load (e.g., search bar)
 */
.search-bar {
  height: 60px;
  scroll-snap-align: start;
}
```

## Strategic Implementation & Best Practices

- **DO** use `scroll-initial-target: nearest` when you want to draw the user's attention to a specific part of a scrollable area upon load and intentionally hide peripheral UI units like a search bar at the very top.
- **DO NOT** confuse this with accessibility focus. This property only moves the **visual** viewport; it does not move the keyboard focus. You must manually manage `element.focus()` if the target is intended to be the starting point for keyboard users.
- **DO NOT** use this if you need a smooth "scrolling" animation on load; this property is discrete and sets the position instantly during the layout phase.
- **DO** account for the **Precedence Hierarchy**: A URL fragment (e.g., `example.com/#top`) and the container-level `scroll-start` property both take precedence over `scroll-initial-target`.

## Fallback Strategy

For browsers that do not yet support the API, use a JavaScript fallback. Note that for pulling content to reveal, you want the main content to bound to the `start` (top) of the container.

```javascript
/**
 * Progressive Enhancement Fallback
 */
document.addEventListener("DOMContentLoaded", () => {
  // Check for native CSS support
  if (!CSS.supports("scroll-initial-target", "nearest")) {
    const targetContent = document.querySelector('.main-content.target');
    if (targetContent) {
      // Use behavior: "instant" to mimic the native CSS behavior
      // 'block: start' should match your CSS 'scroll-snap-align' (or expected top position)
      targetContent.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  }
});
```