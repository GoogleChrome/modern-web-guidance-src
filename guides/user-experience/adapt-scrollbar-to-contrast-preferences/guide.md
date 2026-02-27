---
name: adapt-scrollbar-to-contrast-preferences
description: Enhance scrollbar visibility for users who prefer high-contrast interfaces
web-features:
  - scrollbar-color
  - prefers-contrast
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-color
  - https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast
  - https://developer.chrome.com/en/docs/css-ui/scrollbar-styling
---

# Adapt scrollbar to high-contrast preferences

Users who enable high-contrast modes in their operating system or browser expect UI elements (like scrollbars) to be extremely legible, often relying on stark foreground-background separation rather than subtle grays or theme colors.

This guide provides optional instructions on how to use the `@media (prefers-contrast: more)` CSS media feature to enforce high-contrast scrollbar styling. 

## Enhance Legibility

When customizing scrollbars with `scrollbar-color` or custom variables, you can provide an explicit override for high-contrast modes. This is especially helpful if your primary application theme uses low-contrast scrollbars for aesthetic reasons.

OPTIONAL: Use a `@media (prefers-contrast: more)` block to define dark, distinct colors for the thumb and track.

```css
/* Define default standard colors as variables */
.scroller {
  --scrollbar-thumb: #bbb;
  --scrollbar-track: #f1f1f1;
  
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  scrollbar-width: thin;
  scrollbar-gutter: stable;
}

/* OPTIONAL: Provide clear, high-contrast overrides */
@media (prefers-contrast: more) {
  .scroller {
    /* Use extremely distinct colors like solid black against white */
    --scrollbar-thumb: #000000;
    --scrollbar-track: #ffffff;
  }
}
```

## Fallbacks & Browser Support

If you are using legacy WebKit pseudo-elements to ensure custom colored scrollbars on older versions of Safari/Chrome, the variable assignments from the media query above will automatically cascade to the fallback.

OPTIONAL: The `scrollbar-color` feature is "Baseline Newly Available". If the user's Baseline target is "Baseline Widely Available" or earlier, you SHOULD ensure you provide the legacy fallback code block securely isolated behind `@supports not (scrollbar-color: auto)`.

```css
/* Legacy fallback for WebKit/Blink browsers */
@supports not (scrollbar-color: auto) {
  .scroller::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }
  .scroller::-webkit-scrollbar-thumb {
    /* Will inherit the high-contrast #000000 */
    background: var(--scrollbar-thumb);
    border: 3px solid var(--scrollbar-track);
  }
  .scroller::-webkit-scrollbar-track {
    /* Will inherit the high-contrast #ffffff */
    background: var(--scrollbar-track);
  }
}
```
