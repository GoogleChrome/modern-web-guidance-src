---
name: contrast-color
description: Dynamically select a readable text color based on the background color.
web-feature-ids:
  - contrast-color
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/contrast-color
  - https://drafts.csswg.org/css-color-6/#contrast-color
---

# Ensure text readability with dynamic background colors

When building reusable UI components (like badges or buttons) or supporting dynamic themes, ensuring text is readable against an unpredictable background color can be challenging. The `contrast-color()` CSS function automatically selects either black or white to maximize the contrast ratio against a specified background color.

This guide explains how to use `contrast-color()` to guarantee text legibility.

## Determine optimal text color

When an element has a variable or dynamically injected background color, you can rely on the browser to compute the safest text color.

MANDATORY: You must define a fallback strategy for older browsers, such as using an `@supports` query with a `text-shadow` or variant-specific colors, because a single static fallback color will inevitably fail against some dynamic backgrounds.

MANDATORY: Set the `color` property using the `contrast-color()` function, passing the effective background color (or its custom property) as the argument.

```css
.badge {
  /* Define the background color as a custom property */
  --badge-bg: #e02424;
  background-color: var(--badge-bg);
  
  /* Readability safety net for older browsers */
  color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
}

@supports (color: contrast-color(red)) {
  .badge {
    /* MANDATORY: Dynamic contrasting color */
    color: contrast-color(var(--badge-bg));
    text-shadow: none;
  }
}
```

DO: Use `contrast-color()` primarily when backgrounds are distinctly light or dark. Because the function currently only selects between black or white, mid-tone backgrounds (such as royal blue) may result in suboptimal contrast even when the mathematical maximum is chosen.

DO NOT: Use `contrast-color()` for `background-color`. It is specifically designed for foreground colors (like text or borders) to contrast against a given background color.

## Integrate with custom property theming

Because `contrast-color()` accepts any valid `<color>` value, including CSS custom properties, it is especially powerful within design systems. By centralizing your background themes as variables, you ensure that foreground content automatically updates its contrast whenever the theme shifts.

DO: Reference shared background variables inside `contrast-color()` to guarantee synchronization across your application.

```css
:root {
  --theme-surface-color: #f4f4f4;
}

[data-theme="dark"] {
  --theme-surface-color: #1a1a1a;
}

.theme-card {
  background-color: var(--theme-surface-color);
  color: contrast-color(var(--theme-surface-color));
}
```

## Fallback strategies

{{ FEATURE_FALLBACKS("contrast-color") }}

Due to its limited availability, `contrast-color()` must be applied using progressive enhancement. If the background color is known and fixed for a specific CSS class (like a `.badge-dark` variant), declaring a variant-specific safe default `color` immediately before the `contrast-color()` rule is sufficient, because browsers ignore CSS values they do not understand.

However, if the background color is highly dynamic and unpredictable (such as user-injected themes), a single static fallback will inevitably fail. In these cases, you MUST use an `@supports` feature query to apply a robust fallback strategy, such as a text shadow or translucent background, to guarantee readability.

```css
.dynamic-badge {
  color: #fff; /* Default assumption */
  text-shadow: 0 1px 3px rgba(0,0,0,0.8); /* Readability safety net */
}

@supports (color: contrast-color(red)) {
  .dynamic-badge {
    color: contrast-color(var(--badge-bg));
    text-shadow: none; /* Safe to remove if contrast-color is supported */
  }
}
```
