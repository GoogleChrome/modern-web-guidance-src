---
name: ui-carousel
description: Build responsive, accessible carousels with CSS Scroll Snap
---

# Modern Carousel

A modern carousel (or slider) should rely primarily on CSS for layout and scrolling behavior, using JavaScript only for progressive enhancement (e.g., navigation buttons, tracking).

## Key Features
- **CSS Scroll Snap**: Provides the core "snap-to-slide" functionality.
- **`scroll-behavior: smooth`**: Ensures smooth scrolling when navigating programmatically.
- **Accessibility**: Uses semantic HTML and ensures keyboard navigability.
- **Responsive**: Adapts to different screen sizes naturally.

## Best Practices

### 1. Structure
Use a scrolling container with child items.

For a full working example, see `examples/carousel.html`.

### 2. CSS Scroll Snap
The magic happens in CSS.

### 3. Progressive Enhancement (Optional)
Add "Next" and "Previous" buttons that scroll the container.

## Fallback strategies

If the user's Baseline target (or Widely available, if unavailable) does not support any of the required features, the following fallback strategies MUST be used.

### Scroll Snap

Baseline status: Widely available

- **DO** use `@supports (scroll-snap-type: x mandatory)` for global CSS feature detection if needed, though rarely necessary due to wide support.
- **DO** allow graceful degradation: if scroll snap is not supported, the carousel will simply scroll normally without snapping. This is often an acceptable fallback.
- **DO NOT** use heavy JavaScript polyfills for scroll snap unless strictly required by business needs. The native experience is significantly more performant.

## Anti-Patterns
- **Avoid absolute positioning** for layout calculations.
- **Avoid heavy JS libraries** that reimplement scrolling physics.
- **Don't hide scrollbars** without ensuring the content is clearly scrollable (e.g., using arrows or cut-off content).
