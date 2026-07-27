---
name: contrast-color
description: Select a readable text color with sufficient contrast on a dynamic background color.
web-feature-ids:
  - contrast-color
---

# Ensure text readability with dynamic background colors

When building reusable UI components (like badges or buttons) or supporting dynamic themes, ensuring text is readable against an unpredictable background color can be challenging. The `contrast-color()` CSS function resolves to `black` or `white`, maximizing the contrast ratio against the specified background color.

## Determine optimal text color

When an element has a variable or dynamically injected background color, you can rely on the browser to compute the safest text color.

MANDATORY: Set the `color` property using the `contrast-color()` function, passing the background color (or its custom property) as the argument.

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

DO NOT: Use `contrast-color()` for `background-color`. It is specifically designed for foreground colors (like text or borders) to contrast against a given background color.

## Integrate with custom property theming

Because `contrast-color()` accepts any valid `<color>` value, including CSS custom properties, it is especially powerful within design systems. By centralizing your background themes as variables, you ensure that foreground content automatically updates its contrast whenever the theme shifts.

DO: Reference shared background variables inside `contrast-color()` to guarantee synchronization across your application.

```css
.theme-card {
  background-color: var(--theme-surface-color);
  color: var(--theme-on-surface-color);
}

.theme-container[data-theme="light"] {
  --theme-surface-color: #f4f4f4;
  --theme-on-surface-color: #000; /* Safe fallback */
}
.theme-container[data-theme="dark"] {
  --theme-surface-color: #1a1a1a;
  --theme-on-surface-color: #fff; /* Safe fallback */
}

@supports (color: contrast-color(red)) {
  .theme-card {
    color: contrast-color(var(--theme-surface-color));
  }
}
```

## Ensure contrast on hover and interaction states

When an interactive element's background is driven by a custom property, you can change only that property for hover, focus, or active states and let `contrast-color()` recompute the foreground automatically. Because the text color is expressed once in terms of the background, you never have to hand-pick a matching text color for each state.

DO: Keep a single `color: contrast-color(var(--bg))` declaration so the text stays legible as the background shifts.

```css
.button {
  --button-bg: #b2aeff;
  background-color: var(--button-bg);
  color: #000; /* Safe fallback */
}
.button:is(:hover, :focus){
  --button-bg: #3e3a87;
  color: #fff; /* Safe fallback */
}
 
@supports (color: contrast-color(red)) {
  .button {
    color: contrast-color(var(--button-bg));
  }

  .button:is(:hover, :focus) {
    /* Change the variable used for the background. `contrast-color(--button-bg)` will update the text color. */
    --button-bg: #3e3a87;
  }
}
```

DO NOT: Hard-code a separate text color for each interaction state when the background is dynamic. Doing so reintroduces the very mismatch `contrast-color()` exists to prevent.

## Fallback strategies

{{ FEATURE_FALLBACKS("contrast-color") }}

For browsers that do not yet support `contrast-color()`, use it as a progressive enhancement. If the background color is known and fixed for a specific CSS class (like a `.badge-dark` variant), declare a variant-specific safe default `color` immediately before the `contrast-color()` rule.

However, if the background color is highly dynamic and unpredictable (such as user-injected themes), a single static fallback will inevitably fail. In these cases, you MUST use an `@supports` feature query to apply a robust fallback strategy, such as a text shadow or translucent background, to guarantee readability.

{{ BASELINE_STATUS('relative-color') }}

For browsers without `contrast-color` that support relative color syntax, calculate a white or black contrasting color using your color's lightness channel.

```css
.badge {
  color: #fff; /* Default assumption */
  text-shadow: 0 1px 3px rgb(0 0 0 / 0.8); /* Readability safety net */
}

/* Fallback using relative color syntax  */
@supports (color: oklch(from red l c h)) {
  .badge {
    /* Highest threshold that passes WCAG. Higher values may be more legible. */
    --threshold: 0.623;
    --l: clamp(0, (l / var(--threshold) - 1) * -infinity, 1);
    color: oklch(from var(--badge-bg) var(--l) 0 h);
    text-shadow: none;
  }
}

@supports (color: contrast-color(red)) {
  .badge {
    color: contrast-color(var(--badge-bg));
    text-shadow: none; /* Safe to remove if contrast-color is supported */
  }
}
```

For use cases that require a custom background color without a text shadow, use a JavaScript library like Color.js to calculate whether white or black has the most contrast with the background, and apply the winner as the element's `color` style.
