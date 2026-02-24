---
name: customize-scrollbar-color
description: Change the color scheme of the scrollbar
web-features:
  - scrollbar-color
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-color
  - https://developer.chrome.com/en/docs/css-ui/scrollbar-styling
---

# Customize scrollbar color

The `scrollbar-color` property allows you to change the color scheme of scrollbars. It accepts two `<color>` values: the first value applies to the scrollbar thumb (the moving part), and the second value applies to the scrollbar track (the fixed background).

## Apply `scrollbar-color`

MANDATORY: Use `scrollbar-color` on the scrollable container.

```css
.scroller {
  /* DO: Specify thumb color first, then track color for modern browsers */
  scrollbar-color: hotpink blue;
}
```

## Fallbacks & Browser Support

For legacy browsers (like older versions of Safari and Chrome) that do not support the standard `scrollbar-color` property, you must use the non-standard `::-webkit-scrollbar-thumb` and `::-webkit-scrollbar-track` pseudo-elements.

MANDATORY: To prevent conflicts between standard properties and legacy WebKit selectors in browsers that support both natively (like modern Chrome), you MUST wrap legacy WebKit fallbacks in an `@supports not (scrollbar-color: auto)` block.
MANDATORY: On macOS, `scrollbar-color` (standard) and `::-webkit-scrollbar` (legacy) properties are ignored by default because macOS uses native "overlay" scrollbars. You MUST pair `scrollbar-color` with `scrollbar-width` (e.g., `thin` or `auto`) to force macOS to render the custom colors
MANDATORY: Even with `scrollbar-width` applied, macOS overlay scrollbars render the track (gutter) as transparent by default. If your design requires a visible track background color on MacOS, you MUST apply `scrollbar-gutter: stable;` to the scrollable container, but note that it only appears after the user hovers over the scrollbar.

```css
.scroller {
  /* DO: Apply standard colors natively */
  scrollbar-color: hotpink blue;
  /* DO: Must define width to force macOS to apply the custom colors */
  scrollbar-width: thin;
  /* DO: Force the track background to be visible on macOS */
  scrollbar-gutter: stable;
}

/* Legacy fallback for WebKit/Blink browsers */
@supports not (scrollbar-color: auto) {
  .scroller::-webkit-scrollbar {
    /* DO: Must define base size in WebKit for custom colors to be visual */
    width: 12px;
    height: 12px;
  }
  .scroller::-webkit-scrollbar-thumb {
    /* DO: Use background to color the thumb */
    background: hotpink;
  }
  .scroller::-webkit-scrollbar-track {
    /* DO: Use background to color the track */
    background: blue;
  }
}
```
