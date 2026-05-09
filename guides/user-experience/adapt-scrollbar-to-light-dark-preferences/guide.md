---
name: adapt-scrollbar-to-light-dark-preferences
description: Ensure the scrollbar visually matches the user's operating system light/dark mode preference
web-feature-ids:
  - scrollbar-color
  - color-scheme
  - prefers-color-scheme
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme
  - https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme
  - https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-color
  - https://developer.chrome.com/en/docs/css-ui/scrollbar-styling
---

# Adapt scrollbar colors to light/dark preferences

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

{{ FEATURE("scrollbar-color", "usage") }}

You can use either the `prefers-color-scheme` media query or the `light-dark()` function to define how these colors behave in light and dark mode. The latter will adapt to color-scheme overrides as well (local or global), but has narrower browser support.

Using `light-dark()`:

```css
/* DO: Define light mode colors as variables */
.scroller {
  --scrollbar-thumb: light-dark(#bbb, #555555);
  --scrollbar-track: light-dark(#f1f1f1, #222222);

  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  scrollbar-width: thin;
  scrollbar-gutter: stable;
}
```

Using `prefers-color-scheme`:

```css
/* DO: Define light mode colors as variables */
.scroller {
  --scrollbar-thumb: #bbb;
  --scrollbar-track: #f1f1f1;

  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  scrollbar-width: thin;
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

{{ FEATURE_ISSUES("scrollbar-color") }}

## Fallbacks & Browser Support

{{ FEATURE_FALLBACKS("scrollbar-color") }}


