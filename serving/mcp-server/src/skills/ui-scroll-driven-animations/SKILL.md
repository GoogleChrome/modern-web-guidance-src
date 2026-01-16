---
name: ui-scroll-driven-animations
description: Create animations linked to scroll position
---

# Scroll-driven animations

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll-driven_animations
- https://developer.chrome.com/docs/css-ui/scroll-driven-animations

## Best Practices

Use `animation-timeline: scroll()` to create a reading progress indicator:

For a full working example, see `examples/reading-progress.html`.

Use `animation-timeline: view()` to fade an image in as it enters the viewport:

For a full working example, see `examples/fade-in.html`.

**DO** use a @media query to disable animations if `prefers-reduced-motion` is set to `reduce`.

**DO NOT** style the image's parent element with `overflow: hidden`, as this will put the image in "scroll jail" and prevent the animation from working.

## Fallback strategies

If the user's Baseline target (or Widely available, if unavailable) does not support any of the required features, the following fallback strategies MUST be used.

### Scroll-driven animations

Baseline status: Limited availability

- **DO** use `@supports (animation-timeline: view())` for feature detection
- **DO NOT** set the starting state of an animated element to hidden in unsupported browsers
