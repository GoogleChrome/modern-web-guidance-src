---
name: customize-scrollbar-color-and-thickness
description: Customize the color or thickness of a scrollbar
web-feature-ids:
  - scrollbar-color
  - scrollbar-width
---

# Customize the color or thickness of a scrollbar

You can customize the appearance of scrollbars using the standard CSS properties `scrollbar-color` and `scrollbar-width`.

*   **`scrollbar-color`**: Accepts two `<color>` values. The first applies to the thumb (the moving part), and the second to the track (the fixed background).
*   **`scrollbar-width`**: Accepts `auto` (default), `thin` (a thinner variant), or `none` (hides the scrollbar completely while maintaining scrollability).

## Apply `scrollbar-color` and `scrollbar-width`

MANDATORY: Set `scrollbar-color` together with an explicit `scrollbar-width` on the scrollable container. Default to `scrollbar-width: auto`.

*   **`auto` (default):** Use it unless you have a reason to change the thickness. Setting it explicitly alongside `scrollbar-color` is what makes macOS render the custom colors.
*   **`thin` (opt-in):** The thumb's target size can be too small for some users to operate with a pointer. Use `thin` ONLY when the content can also be scrolled another accessible way (e.g., previous/next buttons), or when the region is secondary and nothing essential is only reachable by dragging its thumb.
*   **`none` (opt-in):** Use it ONLY when another mechanism to scroll is provided (e.g., touch swipe with visible controls, arrow buttons, or paging controls). Never hide the scrollbar on a plain scrolling region.

Choose a thumb color with a contrast ratio of at least 3:1 against the track color, and against the container's background where the track may be transparent, such as with macOS overlay scrollbars, so users can see the thumb and how far they've scrolled (WCAG 1.4.11 Non-text Contrast).

{{ FEATURE("scrollbar-color", "usage") }}

## Fallback strategies

{{ BASELINE_STATUS("scrollbar-width") }}

{{ FEATURE_FALLBACKS("scrollbar-color") }}

