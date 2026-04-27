---
name: customize-scrollbar-color-and-thickness
description: Customize the color or thickness of a scrollbar
web-feature-ids:
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
  /* Specify thumb color first, then track color for modern browsers */
  scrollbar-color: hotpink blue;
  /* Apply standard width property natively */
  scrollbar-width: thin;
  /* Force the track background to be visible on macOS */
  scrollbar-gutter: stable;
}

.scroller-hidden {
  /* Use none to hide scrollbar but keep scrollability */
  scrollbar-width: none;
}
```

IMPORTANT: On macOS, the `scrollbar-color` (standard) and `::-webkit-scrollbar` (legacy) properties are ignored by default because macOS uses native "overlay" scrollbars. Therefore, you MUST apply `scrollbar-width` (e.g., `thin` or `auto`) to force macOS to render custom colors.

IMPORTANT: Do NOT animate or transition `scrollbar-color`. A [WebKit bug](https://bugs.webkit.org/show_bug.cgi?id=311752) causes the scrollbar to flicker every time `scrollbar-color` changes.

## Fallback strategies

{{ BASELINE_STATUS("scrollbar-color") }}

{{ BASELINE_STATUS("scrollbar-width") }}

If the user's Baseline target (or Widely available, if unavailable) does not support any of the required features, the following fallback strategies MUST be used.

Include the non-standard `::-webkit-scrollbar` pseudo-elements as fallbacks.

To prevent conflicts between standard properties and legacy WebKit selectors in browsers that support both natively (like modern Chrome), you MUST wrap legacy WebKit fallbacks in an `@supports not (scrollbar-color: auto)` block.

```css
.scroller {
  /* Apply standard properties natively */
  scrollbar-color: hotpink blue;
  scrollbar-width: thin;
  /* Force the track background to be visible on macOS */
  scrollbar-gutter: stable;
}

/* Legacy fallback for WebKit/Blink browsers */
@supports not (scrollbar-color: auto) {
  .scroller::-webkit-scrollbar {
    /* Must define base size in WebKit for custom colors to be visual */
    width: 12px;
    height: 12px;
  }
  .scroller::-webkit-scrollbar-thumb {
    /* Use background to color the thumb */
    background: hotpink;
    border-radius: 6px;
  }
  .scroller::-webkit-scrollbar-track {
    /* Use background to color the track */
    background: blue;
  }

  .scroller-hidden::-webkit-scrollbar {
    display: none;
    width: 0;
  }
}
```
