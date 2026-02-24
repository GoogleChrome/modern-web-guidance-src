---
name: customize-scrollbar-width
description: Change the thickness of the scrollbar
web-features:
  - scrollbar-width
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-width
  - https://developer.chrome.com/en/docs/css-ui/scrollbar-styling
  - https://www.bram.us/2026/01/15/100vw-horizontal-overflow-no-more/
---

# Customize scrollbar width

The `scrollbar-width` property allows you to customize the maximum thickness of an element's scrollbar. It accepts three values: `auto` (default platform scrollbar width), `thin` (a thinner variant), and `none` (hiding the scrollbar completely while maintaining scrollability).

## Apply `scrollbar-width`

MANDATORY: Use `scrollbar-width` on the scrollable container.

```css
.scroller {
  /* DO: Use standard property for modern browsers */
  scrollbar-width: thin; 
}

.scroller-hidden {
  /* DO: Use none to hide scrollbar but keep scrollability */
  scrollbar-width: none; 
}
```

## Fallbacks & Browser Support

For legacy browsers (like older versions of Safari and Chrome) that do not support the standard `scrollbar-width` property, use the non-standard `::-webkit-scrollbar` pseudo-element. 

MANDATORY: To prevent conflicts between standard properties and legacy WebKit selectors in browsers that support both natively (like modern Chrome), you MUST wrap legacy WebKit fallbacks in an `@supports not (scrollbar-width: auto)` block.

```css
.scroller {
  /* DO: Use standard property natively (ignored by unsupported browsers) */
  scrollbar-width: thin; 
}

/* Legacy fallback for WebKit/Blink browsers */
@supports not (scrollbar-width: auto) {
  .scroller::-webkit-scrollbar {
    /* DO: Use width and height on the pseudo-element to control its thickness */
    width: 8px;
    height: 8px;
  }
}
```
