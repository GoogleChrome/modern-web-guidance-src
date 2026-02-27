---
name: adapt-scrollbar-to-light-dark-preferences
description: Ensure the scrollbar visually matches the user's operating system light/dark mode preference
web-features:
  - scrollbar-color
  - color-scheme
  - prefers-color-scheme
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme
  - https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme
  - https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-color
  - https://developer.chrome.com/en/docs/css-ui/scrollbar-styling
---

# Adapt scrollbar to light/dark preferences

Users expect UI components, including scrollbars, to match the color scheme (light or dark mode) chosen in their operating system settings. The most essential step to achieving this is utilizing the `color-scheme` property. If you choose to apply explicit custom colors, you can use the `@media (prefers-color-scheme: dark)` CSS media feature to modify those colors dynamically.

## 1. System Default Adaptation

The simplest and most robust way to ensure the scrollbar adapts to the user's light/dark mode preference is to let the browser handle it via the `color-scheme` property. When a dark color scheme is enabled, the browser will automatically render its dark-variant scrollbar.

MANDATORY: Define `color-scheme` on the `:root` pseudo-class.

```css
:root {
  /* DO: Declare support for both light and dark systems */
  color-scheme: light dark;
}
```

## 2. Custom Color Adaptation

If you are using `scrollbar-color` or the non-standard `::-webkit-scrollbar` pseudo-elements to explicitly define custom scrollbar colors, you MUST ensure these colors are legible and appropriate in both light and dark modes.

MANDATORY: Use CSS custom properties (variables) to define your colors and update them within a `prefers-color-scheme` media query to avoid repetition.

```css
/* DO: Define light mode colors as variables */
.scroller {
  --scrollbar-thumb: #bbb;
  --scrollbar-track: #f1f1f1;
  
  /* DO: Apply standard property natively */
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  /* DO: Must define width to force macOS to apply the custom colors */
  scrollbar-width: thin;
  /* DO: Force the track background to be visible on macOS */
  scrollbar-gutter: stable;
}

/* DO: Override variables for dark mode */
@media (prefers-color-scheme: dark) {
  .scroller {
    --scrollbar-thumb: #555555;
    --scrollbar-track: #222222;
  }
}
```

## Fallbacks & Browser Support

MANDATORY: The `scrollbar-color` and `scrollbar-width` features are "Baseline Newly Available". If the user's Baseline target is "Baseline Widely Available" or earlier, you SHOULD include the non-standard `::-webkit-scrollbar` pseudo-elements as fallbacks.
MANDATORY: To prevent conflicts between standard properties and legacy WebKit selectors in browsers that support both natively (like modern Chrome), you MUST wrap legacy WebKit fallbacks in an `@supports not (scrollbar-color: auto)` block.
MANDATORY: On macOS, `scrollbar-color` (standard) and `::-webkit-scrollbar` (legacy) properties are ignored by default because macOS uses native "overlay" scrollbars. You MUST pair custom colors with `scrollbar-width` (e.g., `thin` or `auto`) to force macOS to render them.
MANDATORY: Even with `scrollbar-width` applied, macOS overlay scrollbars render the track (gutter) as transparent by default. If your design requires a visible track background color on MacOS, you MUST apply `scrollbar-gutter: stable;` to the scrollable container, but note that it only appears after the user hovers over the scrollbar.



```css
/* Legacy fallback for WebKit/Blink browsers */
@supports not (scrollbar-color: auto) {
  .scroller::-webkit-scrollbar {
    /* DO: Must define base size in WebKit for custom colors to be visual */
    width: 12px;
    height: 12px;
  }
  .scroller::-webkit-scrollbar-thumb {
    /* DO: Apply the thumb variable */
    background: var(--scrollbar-thumb);
  }
  .scroller::-webkit-scrollbar-track {
    /* DO: Apply the track variable */
    background: var(--scrollbar-track);
  }
}
```
