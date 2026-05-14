---
name: component-specific-light-dark-theme
description: Create component-specific themes by forcing explicit color schemes on individual UI elements, giving users theme choices that are decoupled from their global operating system preferences
web-feature-ids:
  - color-scheme
  - light-dark
---

# Component-Specific Light/Dark Themes

The `light-dark()` function allows you to define two colors for a single property, which the browser automatically switches based on the current `color-scheme`. By scoping both the `light-dark()` variables and the `color-scheme` property to a specific component, you can create UI elements that can be independently forced into light or dark mode, regardless of the user's global system preference.

## Implementation steps

1. **MANDATORY: Enable `color-scheme` support.** The `light-dark()` function only resolves if the element (or an ancestor) has an explicit `color-scheme` value of `light`, `dark`, or `light dark`.

    ```css
    :root {
      /* 
         MANDATORY: Enable system-wide support for both themes.
         Without this, the browser will not know how to resolve light-dark().
      */
      color-scheme: light dark;
    }
    ```

2. **Define semantic variables or properties using `light-dark()`.** Use the `light-dark(light-color, dark-color)` syntax. 

    ```css
    .themed-card {
      /* 
         DO: Use semantic variables to define theme-aware colors.
         The first argument is used when color-scheme is 'light'.
         The second argument is used when color-scheme is 'dark'.
      */
      --card-bg: light-dark(#ffffff, #2d2e31);
      --card-text: light-dark(#202124, #f8f9fa);
      
      background-color: var(--card-bg);
      color: var(--card-text);
      padding: 1.5rem;
      border-radius: 8px;
    }
    ```

3. **Create theme overrides.** You can force a component instance into a specific theme by setting its `color-scheme` property using any valid CSS selector (classes, data attributes, etc.). This overrides the inherited system preference for that specific subtree.

    ```css
    /* 
       DO: Use color-scheme to force a specific theme on a component.
       You can use classes, data attributes, or any other selector.
    */
    
    /* Using classes */
    .themed-card.force-light {
      color-scheme: light;
    }

    /* Using data attributes (often preferred for state) */
    .themed-card[data-theme="dark"] {
      color-scheme: dark;
    }
    ```

## Critical Considerations

- **Supported Types**: Currently, `light-dark()` is only used for color values. It cannot be used for lengths, numbers, or other non-color types (e.g., `padding`, `font-size`, `opacity`).
- **MANDATORY: Two Arguments**: The function must always have exactly two arguments.

```css
/* 
   DO NOT: Attempt to use light-dark() for non-color properties like padding.
   This will result in an invalid property value.
*/
.themed-card {
  padding: light-dark(10px, 20px); 
}
```

## Fallback strategies

{{ BASELINE_STATUS("light-dark") }}
{{ BASELINE_STATUS("color-scheme") }}

### Color Fallbacks
For browsers that do not support `light-dark()` or the `color-scheme` property, provide a fallback using `@media (prefers-color-scheme: dark)` or manual variable overrides.

```css
.themed-card {
  /* 
     MANDATORY: Define base fallback colors for browsers without light-dark().
     Default to light mode values.
  */
  --card-bg: #ffffff;
  --card-text: #202124;
}

/* 
   DO: Update variables based on system preference for older browsers.
*/
@media (prefers-color-scheme: dark) {
  .themed-card {
    --card-bg: #2d2e31;
    --card-text: #f8f9fa;
  }
}

/* 
   DO: Use @supports to provide progressive enhancement for light-dark().
   This ensures that per-component overrides (via color-scheme) work where supported.
*/
@supports (color: light-dark(white, black)) {
  .themed-card {
    --card-bg: light-dark(#ffffff, #2d2e31);
    --card-text: light-dark(#202124, #f8f9fa);
  }
}
```
