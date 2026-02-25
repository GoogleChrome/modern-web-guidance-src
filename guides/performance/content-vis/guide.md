---
description: Improve initial page load and interaction responsiveness by deferring the rendering work of off-screen components until they are needed.
---

# Optimize Rendering of Long Pages

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility
- https://developer.mozilla.org/en-US/docs/Web/CSS/contain-intrinsic-size
- https://web.dev/articles/content-visibility

## Best Practices

Use `content-visibility: auto` to allow the browser to skip layout and paint work for elements while they are off-screen. Pair this with `contain-intrinsic-size` to provide a placeholder dimension, preventing layout shifts and "jumpy" scrollbars when content enters the viewport.

```css
/* Target major sections or "DOM islands" below the initial viewport */
.article-section, .feed-item {
  content-visibility: auto;
  
  /* Use 'auto' to cache the actual size once rendered, plus a reasonable estimate */
  contain-intrinsic-size: auto 600px;
}

/* Use hidden for inactive views (SPAs, tabs) to preserve state without rendering cost */
.tab-panel:not(.active) {
  content-visibility: hidden;
}

/* Handle animations for discrete property changes */
.fade-element {
  transition: content-visibility 0.5s allow-discrete, opacity 0.5s;
}
```

### Strategic Implementation
- **DO** target major, self-contained blocks of content (e.g., blog posts in a list, complex cards, or individual sections of a long article).
- **DO NOT** apply this to elements in the initial viewport, especially the Largest Contentful Paint (LCP) element, as it can delay the first meaningful paint.
- **DO** use the `auto` keyword in `contain-intrinsic-size` (e.g., `auto 500px`). This tells the browser to remember the element's actual rendered size once it has been seen, ensuring the scrollbar remains stable when the user scrolls back up.
- **DO** provide accurate placeholder estimates to minimize Cumulative Layout Shift (CLS).

### Accessibility and DOM Integrity
- **DO** remember that `content-visibility: auto` content remains in the accessibility tree and is searchable via "Find in Page".
- **DO** use `aria-hidden="true"` if a subtree contains elements that should be hidden from screen readers, as the browser won't render `display: none` styles for off-screen skipped content.

### API Discipline and State Management
- **DO NOT** call JavaScript APIs that force synchronous layout (e.g., `offsetTop`, `getBoundingClientRect()`, `getComputedStyle()`) on elements within a skipped subtree, as this forces the browser to perform the rendering work you are trying to defer.
- **DO** use the `contentvisibilityautostatechange` event if your application needs to manage side-processes (like `<canvas>` animations or data polling) when rendering starts or stops.
- **DO** use `content-visibility: hidden` for inactive views in Single Page Applications (SPAs). This preserves the rendering state (unlike `display: none`), allowing for near-instant "unhiding".

### Performance and Verification
- **DO** monitor CPU Paint, Layout time, and Main Thread work in performance profiles. Successful implementation should lead to improved Interaction to Next Paint (INP) scores.
- **DO** enable "Verbose" logging in Chromium-based browsers to catch warnings about APIs that triggered rendering on a skipped subtree.

## Fallback strategies

`content-visibility` is a progressive enhancement. Browsers that do not support the property will simply render the content as normal (defaulting to `visible`).

### Feature Detection

- **DO** use `@supports (content-visibility: auto)` for CSS-based feature detection.
- **DO** use `if ('contentVisibility' in document.documentElement.style)` for JavaScript-based feature detection.

### Handling Legacy Browsers

- **DO** ensure that your estimated height in `contain-intrinsic-size` is as accurate as possible. While legacy browsers will ignore the property, modern browsers will use it as a fallback before the first render, affecting the page's cumulative layout shift (CLS).
- **DO** verify behavior across modern engines (Chromium, Firefox, Safari) to ensure no quirks in layout containment or scrollbar behavior occur on your specific implementation.
