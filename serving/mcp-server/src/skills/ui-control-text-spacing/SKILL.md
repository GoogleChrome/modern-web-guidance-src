---
description: Control the space above and below text elements for improved optical balance and alignment, particularly in buttons and tags.
filename: control-text-spacing
category: ui
---

# Control Text Spacing

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/CSS/text-box-trim
- https://developer.mozilla.org/en-US/docs/Web/CSS/text-box-edge

## Best Practices

Use `text-box-trim` and `text-box-edge` to precisely control the space above and below text content, achieving optical balance and simplifying alignment tasks. This is particularly useful for elements like buttons and tags where consistent visual spacing is crucial.

For most common scenarios, trimming both sides to the capital letters is recommended:

```css
h1 {
  /* trim both sides to the capital letters */
  text-box: trim-both cap alphabetic;
}
```

When dealing with elements like buttons, `text-box` allows for consistent padding to achieve optical centering:

```css
button {
  text-box: trim-both cap alphabetic;
  padding: 10px;
}
```

The same principle applies to elements like `<span>` used for tags or badges, where trimming leading space results in tighter, optically centered content.

```css
.tag {
  text-box: trim-both cap alphabetic;
  padding: 5px 10px;
}
```

For alignment purposes, especially when placing text next to images or in multi-line scenarios, `text-box` can ensure perfect alignment by removing the excess half-leading space.

```css
.container {
  display: flex;
  align-items: center;
}

.text-content {
  text-box: trim-both cap alphabetic;
}

.image-content {
  /* Image styles */
}
```

## Fallback strategies

`text-box` is a relatively new CSS feature. If browser support is a concern, consider the following:

### CSS `text-box`

- **DO** use `@supports (text-box-trim: none)` for CSS feature detection.
- **DO** provide alternative styling that works without `text-box` for browsers that do not support it. This might involve accepting slightly less ideal spacing or using older techniques to approximate the effect.
- **DO** link to resources like [Codepen collection of all the demos](https://codepen.io/collection/zxQBaL) for examples of how `text-box` functions across various scenarios.

Consider providing a visual fallback that either relies on standard padding or a simpler layout that doesn't heavily depend on precise text-box spacing.