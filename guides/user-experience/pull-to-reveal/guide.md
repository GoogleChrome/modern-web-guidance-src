---
name: pull-to-reveal
description: Build a pull-to-reveal feature that would enable the user to pull down on the screen to reveal more content, like a search bar.
web-feature-ids:
  - scroll-initial-target
---

# Pull to Reveal

Prior to `scroll-initial-target`, developers heavily relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#content-id`) to hide a top search bar or refresh control on initial load, forcing the user to scroll up (pull down) to reveal it. The experimental CSS property `scroll-initial-target` offers a declarative CSS-only way to achieve this, bringing a specific child element (like the main content below the initially hidden element) into the visible area of its scroll container as soon as the container is rendered.

## How to implement

The `scroll-initial-target` property allows you to declaratively set which child element should be scrolled into view when a scroll container is first displayed.

To implement this:
1. Ensure the parent element is a scroll container (e.g., `overflow-y: auto` or `overflow-y: scroll`).
2. Apply `scroll-initial-target: nearest` to the main content element sitting below the section you want hidden.

When multiple elements specify an initial target within the same container, the user agent selects the one which comes first in the tree order. Once the user manually scrolls or an explicit programmatic scroll is triggered, the initial target isn't active anymore and the scroll container can be freely scrolled.

## Example code

```css
/* The scroll container */
.app-container {
  height: 100vh;
  overflow-y: auto;
}

/* The element we want to hide on load (e.g., search bar) */
.search-bar {
  height: 60px;
}

/* The specific element to focus on initial render, pushing the search bar out of view */
.main-content.target {
  scroll-initial-target: nearest;
}
```

## Fallback strategies

`scroll-initial-target` is an experimental feature and is not yet supported across all major browsers. A fallback strategy using JavaScript is recommended for cross-browser compatibility.

### Feature Detection & Polyfill

Use `@supports` to check for support in CSS, or check the CSS property in JavaScript to conditionally run a `scrollIntoView()` fallback. Note that for pulling content to reveal, you want the main content to bound to the `start` (top) of the container.

```javascript
document.addEventListener("DOMContentLoaded", () => {
  const targetContent = document.querySelector('.main-content.target');

  if (targetContent && !CSS.supports('scroll-initial-target', 'nearest')) {
    // Fallback for browsers that don't support the CSS property
    targetContent.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
});
```

You can leave the default scroll position as a safe fallback for progressive enhancement if the specific target content isn't critical for the initial view (users will just see the search bar immediately instead of having to pull to reveal it).

## Strategic implementation

- **DO** use `scroll-initial-target: nearest` when you want to draw the user's attention to a specific part of a scrollable area upon load and intentionally hide peripheral UI units like a search bar at the very top.
- **DO NOT** use this as a replacement for standard accessibility focus. This property only affects the visual scroll position; it does not move keyboard focus.
- **DO NOT** use it if you need to animate the scroll position on load; this property sets the *initial* position instantly.
- **DO** understand that the property is only effective on the *initial* render or when the scroll container's content changes significantly.
- **DO** note that it will not override fragment navigation (if a URL has a `#hash` identifier it takes precedence).

## References

- [scroll-initial-target GitHub Explainer](https://github.com/DavMila/explainer-scroll-initial-target)
- [Chrome Platform Status](https://chromestatus.com/feature/6276178888097792)
- [CSS Scroll Snap Module Level 2](https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target)
- [Web Platform Status](https://webstatus.dev/features/scroll-initial-target)
