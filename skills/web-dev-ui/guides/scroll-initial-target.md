---
description: Set the initial scroll position of a container to a specific child element
web-feature-ids:
  - scroll-initial-target
  - css-scroll-snap
---

# Scroll Initial Target

Reference docs:

- https://drafts.csswg.org/css-scroll-snap-2/#scroll-initial-target
- https://chromestatus.com/feature/5196656488742912
- https://github.com/w3c/csswg-drafts/issues/10665

## Best Practices

The `scroll-initial-target` property allows you to declaratively set which child element should be scrolled into view when a scroll container is first displayed. This is much more performant and reliable than using JavaScript `scrollIntoView()` on load.

**DO** use it for:

- **Carousels**: Starting at a specific slide (e.g., "today's deal").
- **Chat Interfaces**: Scrolling to the latest message at the bottom.
- **Tab Panels**: Ensuring the active tab content is visible if it overflows.

```css
.carousel {
  overflow-x: auto;
  /* ... */
}

.slide.active {
  scroll-initial-target: nearest;
}
```

**DO NOT** use it if you need to animate the scroll position on load; this property sets the _initial_ position instantly.

## Baseline Status

Baseline: **Limited availability (Experimental)**

- **Status**: Limited availability (Experimental).
- **Documentation**: [Web Platform Status](https://webstatus.dev/features/scroll-initial-target)
- **Availability**: Supported in Chrome 133+, Edge 133+. Not yet in Safari or Firefox.
- **Caveats**: Was previously discussed as `scroll-start-target`. Ensure you use the standardized `scroll-initial-target`.

## Fallback Strategies

Since support is limited, you MUST provide a JavaScript fallback for browsers that don't support this property.

### Feature Detection & Polyfill

Use `@supports` to check for support, or check the CSS property in JavaScript.

```javascript
const scrollContainer = document.querySelector(".carousel");
const target = document.querySelector(".slide.active");

if (target && !CSS.supports("scroll-initial-target", "nearest")) {
  // Fallback for older browsers
  target.scrollIntoView({ block: "nearest", inline: "nearest" });
}
```

### Progressive Enhancement

You can leave the default scroll position (0,0) as a safe fallback if the specific target content isn't critical for the initial view.

