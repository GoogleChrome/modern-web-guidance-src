---
name: component-specific-light-dark-theme
description: Create component-specific themes by forcing explicit color schemes on individual UI elements, giving users theme choices that are decoupled from their global operating system preferences
web-feature-ids: 
  - color-scheme
  - light-dark
sources: 
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/light-dark
  - https://web.dev/articles/baseline-in-action-color-theme?hl=en
  - https://web.dev/articles/building/a-theme-switch-component?hl=en
  - https://nerdy.dev/page-and-component-light-dark-strategies
  - https://www.bram.us/2023/10/09/the-future-of-css-easy-light-dark-mode-color-switching-with-light-dark/
  - https://css-tricks.com/almanac/functions/l/light-dark/
  - https://www.bram.us/2020/04/26/the-quest-for-the-perfect-dark-mode-using-vanilla-javascript/
  - https://css-tricks.com/come-to-the-light-dark-side/
  - https://web.dev/articles/light-dark
  - https://www.bram.us/2026/03/19/more-easy-light-dark-mode-switching-light-dark-is-about-to-support-images/
---

# Component-Specific Light/Dark Themes

The `light-dark()` function allows you to define two values (either colors or images) for a single property, which the browser automatically switches based on the current `color-scheme`. By scoping both the `light-dark()` variables and the `color-scheme` property to a specific component, you can create UI elements that can be independently forced into light or dark mode, regardless of the user's global system preference.

## Implementation steps

1. **MANDATORY: Enable `color-scheme` support.** The `light-dark()` function only resolves if the element (or an ancestor) has an explicit `color-scheme` value of `light`, `dark`, or `light dark`.

    ```css
    :root {
      /* Enable system-wide support for both themes */
      color-scheme: light dark;
    }
    ```

2. **Define semantic variables or properties using `light-dark()`.** Use the `light-dark(light-value, dark-value)` syntax. Both values must be of the same type (both colors or both images).

    ```css
    .themed-card {
      /* Example with colors */
      --card-bg: light-dark(#ffffff, #2d2e31);
      --card-text: light-dark(#202124, #f8f9fa);
      
      /* Example with images/gradients */
      background-image: light-dark(
        linear-gradient(white, #eee), 
        linear-gradient(#2d2e31, #111)
      );

      background-color: var(--card-bg);
      color: var(--card-text);
      padding: 1.5rem;
      border-radius: 8px;
    }
    ```

3. **Create theme override classes.** You can force a component instance into a specific theme by setting its `color-scheme` property directly. This overrides the inherited system preference for that specific subtree.

    ```css
    /* This card will always use the light-value from light-dark() */
    .themed-card.force-light {
      color-scheme: light;
    }

    /* This card will always use the dark-value from light-dark() */
    .themed-card.force-dark {
      color-scheme: dark;
    }
    ```

## Fallback strategies

{{ BASELINE_STATUS("light-dark") }}
{{ BASELINE_STATUS("color-scheme") }}

### Color Fallbacks
For browsers that do not support `light-dark()` or the `color-scheme` property, provide a fallback using `@media (prefers-color-scheme: dark)` or manual variable overrides.

```css
.themed-card {
  /* Fallback: define light mode colors first */
  --card-bg: #ffffff;
  --card-text: #202124;
}

/* Update variables based on system preference */
@media (prefers-color-scheme: dark) {
  .themed-card {
    --card-bg: #2d2e31;
    --card-text: #f8f9fa;
  }
}

/* Use light-dark() where supported for per-component overrides */
@supports (color: light-dark(white, black)) {
  .themed-card {
    --card-bg: light-dark(#ffffff, #2d2e31);
    --card-text: light-dark(#202124, #f8f9fa);
  }
}
```

### Image Fallbacks
**MANDATORY**: As of early 2026, support for `<image>` values in `light-dark()` is more restricted than color support (e.g., supported in Firefox 150+, but behind flags in other browsers). Always provide a standard `background-image` fallback.

```css
.hero {
  /* Fallback for all browsers */
  background-image: url('light-hero.jpg');
}

@media (prefers-color-scheme: dark) {
  .hero {
    background-image: url('dark-hero.jpg');
  }
}

/* Progressive enhancement for modern browsers */
@supports (background-image: light-dark(url(l.png), url(d.png))) {
  .hero {
    background-image: light-dark(url('light-hero.jpg'), url('dark-hero.jpg'));
  }
}
```

## Critical Considerations

- **Staggered Browser Support**: While `light-dark()` for colors is widely supported, support for **`<image>`** values (including gradients and `url()`) is newer and may require feature detection via `@supports`.
- **MANDATORY: Type Consistency**: Both arguments in `light-dark()` must be of the same type. You cannot mix colors and images (e.g., `light-dark(white, url('dark.png'))` is invalid).
- **Unsupported Properties**: It cannot be used for lengths, numbers, or other non-color/image types (e.g., `padding`, `font-size`, `opacity`).

```css
/* INVALID: light-dark() only accepts colors or images */
.themed-card {
  padding: light-dark(10px, 20px); 
}
```
