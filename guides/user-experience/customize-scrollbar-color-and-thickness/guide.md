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

{{ FEATURE("scrollbar-color", "usage") }}

## Fallback strategies

{{ BASELINE_STATUS("scrollbar-width") }}

{{ FEATURE_FALLBACKS("scrollbar-color") }}

