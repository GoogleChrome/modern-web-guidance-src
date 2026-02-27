---
name: customize-scrollbar-color-and-thickness
description: Customize the color or thickness of a scrollbar
web-features:
  - scrollbar-color
  - scrollbar-width
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-color
  - https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-width
  - https://developer.chrome.com/en/docs/css-ui/scrollbar-styling
  - https://www.bram.us/2026/01/15/100vw-horizontal-overflow-no-more/
---

# Customize the color or thickness of a scrollbar

You can customize the appearance of scrollbars using the standard CSS properties `scrollbar-color` and `scrollbar-width`.

*   **`scrollbar-color`**: Accepts two `<color>` values. The first applies to the thumb (the moving part), and the second to the track (the fixed background).
*   **`scrollbar-width`**: Accepts `auto` (default), `thin` (a thinner variant), or `none` (hides the scrollbar completely while maintaining scrollability).

## Apply `scrollbar-color` and `scrollbar-width`

MANDATORY: Use `scrollbar-color` and `scrollbar-width` on the scrollable container.

```css
.scroller {
  /* DO: Specify thumb color first, then track color for modern browsers */
  scrollbar-color: hotpink blue;
  /* DO: Apply standard width property natively */
  scrollbar-width: thin; 
}

.scroller-hidden {
  /* DO: Use none to hide scrollbar but keep scrollability */
  scrollbar-width: none; 
}
```

## Fallbacks & Browser Support

MANDATORY: These features are "Baseline Newly Available" (as of 2024/2025). If the user's Baseline target is "Baseline Widely Available" or earlier, you SHOULD include the non-standard `::-webkit-scrollbar` pseudo-elements as fallbacks.
MANDATORY: To prevent conflicts between standard properties and legacy WebKit selectors in browsers that support both natively (like modern Chrome), you MUST wrap legacy WebKit fallbacks in an `@supports not (scrollbar-color: auto)` block.
MANDATORY: On macOS, `scrollbar-color` (standard) and `::-webkit-scrollbar` (legacy) properties are ignored by default because macOS uses native "overlay" scrollbars. You MUST apply `scrollbar-width` (e.g., `thin` or `auto`) to force macOS to render custom colors.
MANDATORY: Even with `scrollbar-width` applied, macOS overlay scrollbars render the track (gutter) as transparent by default. If your design requires a visible track background color on MacOS, you MUST apply `scrollbar-gutter: stable;` to the scrollable container.

```css
.scroller {
  /* DO: Apply standard properties natively */
  scrollbar-color: hotpink blue;
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
    border-radius: 6px;
  }
  .scroller::-webkit-scrollbar-track {
    /* DO: Use background to color the track */
    background: blue;
  }
  
  .scroller-hidden::-webkit-scrollbar {
    display: none;
    width: 0;
  }
}
```
