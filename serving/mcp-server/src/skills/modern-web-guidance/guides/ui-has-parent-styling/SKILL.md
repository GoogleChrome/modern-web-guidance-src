---
description: Style parent elements and their children dynamically based on the state of their descendants using the :has() CSS selector.
filename: has-parent-styling.md
category: ui
---

# Dynamic Parent Styling with `:has()`

The `:has()` CSS pseudo-class allows you to select a parent element based on its descendants, enabling dynamic styling of components without relying on JavaScript. This is particularly useful for creating more interactive and visually responsive user interfaces.

## Best Practices

Use `:has()` to conditionally style parent containers or elements based on the presence, state, or attributes of their children.

### Policybazaar - Plan Comparison UI

Policybazaar uses `:has()` to visually indicate which plan types are selectable in a comparison UI. When one plan type is selected, `:has()` is used to style the parent container of the *other* plan types, making them appear disabled.

```css
.plan-group-container:has(.disabled-group) {
  opacity: 0.5;
  filter: grayscale(100%);
}

.plan-group-container:has(.disabled-section) .button {
  pointer-events: none;
  border-color: #B5B5B5;
  color: var(--text-primary-38-color);
  background: var(--input-border-color);
}
```

### Policybazaar - Inline Quiz

The health team at Policybazaar uses `:has()` to trigger animations when a question in an inline quiz is answered. By checking if an input checkbox within a question container is `:checked`, they can apply styles that transition to the next question.

```css
.segment_banner__wrap__questions {
 position: relative;
 animation: quesSlideIn 0.3s linear forwards;
}

.segment_banner__wrap__questions:has(input:checked) {
 animation: quesSlideOut 0.3s 0.3s linear forwards;
}

@keyframes quesSlideIn {
 from {
   transform: translateX(50px);
   opacity: 0;
 }
 to {
   transform: translateX(0px);
   opacity: 1;
 }
}

@keyframes quesSlideOut {
 from {
   transform: translateX(0px);
   opacity: 1;
 }
 to {
   transform: translateX(-50px);
   opacity: 0;
 }
}
```

### Tokopedia - Product Thumbnails

Tokopedia uses `:has()` to add a visual overlay to product thumbnails that contain a video. If a thumbnail's parent container has a `.playIcon` class, an overlay is applied using the `::after` pseudo-element.

```js
/* Using CSS-in-JS, but demonstrates the :has() logic */
.thumbnailWrapper > div {
  /* ... other styles */

  @supports selector(:has(*)) {
    &:has(.playIcon) {
      &::after {
        content: '';
        display: block;
        background: rgba(0, 0, 0, 0.2);
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
      }
    }
  }

  & > .playIcon {
    position: absolute;
    top: 25%;
    left: 25%;
    width: 50%;
    height: 50%;
    text-align: center;
    z-index: 1;
  }
}
```

## Fallback strategies

For browsers that do not support `:has()`, consider providing alternative styling or functionality. This might involve using JavaScript to add classes or relying on simpler selectors that achieve a similar, albeit less dynamic, effect.

-   **DO** use `@supports selector(:has(*))` for CSS feature detection to conditionally apply styles or load polyfills.
-   **DO** provide a graceful degradation for non-supporting browsers, ensuring the core functionality remains accessible.
-   **DO** consider using a JavaScript polyfill if `:has()` is critical for a specific user experience in older browsers, but be mindful of performance implications.

## Resources:

-   [MDN Web Docs - `:has()`](https://developer.mozilla.org/en-US/docs/Web/CSS/:has)
-   [web.dev - The `:has()` CSS pseudo-class](https://web.dev/articles/css-has)
-   [Demos :has()](https://codepen.io/collection/xKzYaq)