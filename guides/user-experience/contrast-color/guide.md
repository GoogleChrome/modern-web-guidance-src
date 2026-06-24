---
name: contrast-color
description: Select a readable text color with sufficient contrast on a dynamic background color.
web-feature-ids:
  - contrast-color
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
  text-shadow: 0 1px 3px rgb(0 0 0 / 0.8);
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

## Derive readable hover and interaction states

When an interactive element's background is driven by a custom property, you can change only that property for hover, focus, or active states and let `contrast-color()` recompute the foreground automatically. Because the text color is expressed once in terms of the background, you never have to hand-pick a matching text color for each state.

DO: Adjust the background custom property with [relative color syntax](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_colors/Relative_colors) and keep a single `color: contrast-color(var(--bg))` declaration so the text stays legible as the background shifts. This "algorithmic hover state" technique is described in [Dave Rupert's write-up](https://daverupert.com/2026/01/algorithmic-hover-states-with-contrast-color/).

```css
.button {
  --button-bg: #4f46e5;
  background-color: var(--button-bg);
  color: contrast-color(var(--button-bg));
}

@supports (color: contrast-color(red)) {
  .button:hover {
    /* Darken the background; the text color re-derives on its own */
    --button-bg: oklch(from #4f46e5 calc(l - 0.1) c h);
  }
}
```

DO NOT: Hard-code a separate text color for each interaction state when the background is dynamic. Doing so reintroduces the very mismatch `contrast-color()` exists to prevent.

## Build colors beyond black and white

The value returned by `contrast-color()` is always black or white, but you can feed that result into relative color syntax to derive related colors that still react to the background—for example a translucent scrim, a muted caption color, or a subtle border.

MANDATORY: Re-verify contrast whenever you transform the result of `contrast-color()`. As soon as you move away from pure black or white, the browser's contrast guarantee no longer holds, so you must confirm the derived color still meets your target ratio (for example WCAG AA) against the background.

```css
.callout {
  --callout-bg: #1a1a1a;
  background-color: var(--callout-bg);
  color: contrast-color(var(--callout-bg));

  /* Derive a dimmed secondary color from the guaranteed contrast color.
     Verify the resulting ratio—dimming reduces contrast. */
  --callout-muted: rgb(from contrast-color(var(--callout-bg)) r g b / 0.7);
}

.callout small {
  color: var(--callout-muted);
}
```

DO: Treat derived colors as a progressive enhancement on top of the guaranteed black/white value, reserving the unmodified `contrast-color()` output for text that must remain readable.

## Fallback strategies

{{ FEATURE_FALLBACKS("contrast-color") }}

Due to its limited availability, `contrast-color()` must be applied using progressive enhancement. If the background color is known and fixed for a specific CSS class (like a `.badge-dark` variant), declaring a variant-specific safe default `color` immediately before the `contrast-color()` rule is sufficient, because browsers ignore CSS values they do not understand.

However, if the background color is highly dynamic and unpredictable (such as user-injected themes), a single static fallback will inevitably fail. In these cases, you MUST use an `@supports` feature query to apply a robust fallback strategy, such as a text shadow or translucent background, to guarantee readability.

```css
.dynamic-badge {
  color: #fff; /* Default assumption */
  text-shadow: 0 1px 3px rgb(0 0 0 / 0.8); /* Readability safety net */
}

@supports (color: contrast-color(red)) {
  .dynamic-badge {
    color: contrast-color(var(--badge-bg));
    text-shadow: none; /* Safe to remove if contrast-color is supported */
  }
}
```
