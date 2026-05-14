---
name: component-specific-light-dark-theme
description: Create component-specific themes by forcing explicit color schemes on individual UI elements, giving users theme choices that are decoupled from their global operating system preferences
web-feature-ids:
  - color-scheme
  - light-dark
sources:
  - https://web.dev/articles/light-dark
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/light-dark
  - https://web.dev/articles/baseline-in-action-color-theme?hl=en
  - https://web.dev/articles/building/a-theme-switch-component?hl=en
  - https://nerdy.dev/page-and-component-light-dark-strategies
  - https://www.bram.us/2023/10/09/the-future-of-css-easy-light-dark-mode-color-switching-with-light-dark/
  - https://css-tricks.com/almanac/functions/l/light-dark/
  - https://www.bram.us/2020/04/26/the-quest-for-the-perfect-dark-mode-using-vanilla-javascript/
  - https://css-tricks.com/come-to-the-light-dark-side/
---

# Component-Specific Light/Dark Themes

The `light-dark()` function allows you to define two colors for a single property, which the browser automatically switches based on the current `color-scheme`. By scoping both the `light-dark()` variables and the `color-scheme` property to a specific component, you can create UI elements that can be independently forced into light or dark mode, regardless of the user's global system preference.

## Why use component-specific themes?

While most element's should follow the page-wide color scheme, there are several scenarios where you need more granular control over an element's theme:

- **Content-Driven Aesthetics**: Certain components work best in a specific mode. For example, **code editors**, **video players**, and **photo galleries** often use a particular theme to minimize distraction and make colors "pop," regardless of the user's OS setting.
- **User Preference Overrides**: You can empower users to manually toggle the theme of a specific component, like a chat box or a music player for example. This allows them to view a component in the mode that fits their environment or eye comfort.

## When to Change Colors vs. When to Force `color-scheme`

### 1. Change Colors when:
*   You only need to update certain properties of author styled elements (like the background of a `<div>` or the color of an `<h1>`).
*   The component doesn't contain any "native" interactive parts.
*   **Result:** Only the parts you explicitly styled will change.

### 2. Force `color-scheme` when:
*  You've decided that the built-in browser UI like **scrollbars** (e.g., a scrollable code block or sidebar) or **form controls** (like `<select>` menus, checkboxes, or date pickers) should use the colors of a particular color scheme.
*  The component is best viewed in a particular color mode based on its content, for example, the dominant colors of a video, image, or graphic.
*   **Result:** The browser automatically themes the "hidden" parts you can't easily reach with CSS, or the component is always viewed as intended in the design. 

## Implementation Steps

### 1. Declare supported schemes in HTML
OPTIONAL: To help prevent a "flash of un-themed content" (FOUC), place a `<meta>` tag in your `<head>` to ensure the browser knows which themes you support before it even starts rendering. While this `<meta>` tag helps to avoid FOUC by setting the initial canvas color early, it may not completely eliminate flashes in all browsers or loading conditions.

```html
<!-- Optional: Declare support for both light and dark themes -->
<meta name="color-scheme" content="light dark">
```

### 2. Enable `color-scheme` support
OPTIONAL: Enable global support for both color schemes by setting `color-scheme: light dark;` on the `:root`.

```css
:root {
  /* **Optional:** Enable global support for both color schemes */
  color-scheme: light dark;
}
```

### 3. Define theme-aware variables
Using custom properties creates a **semantic abstraction layer** for your component's theme. This allows your styling to remain constant while the *values* of your variables adapt to the theme context. It also simplifies fallback management and provides the essential mechanism for re-resolving values in nested "theme islands" to avoid inheritance issues without repeating complex logic on every property.

```css
.themed-card {
  /* 1. Define raw brand colors for each mode */
  --card-bg-light: #ffffff;
  --card-bg-dark: #2d2e31;
  --card-text-light: #202124;
  --card-text-dark: #f8f9fa;

  /* 2. Modern enhancement using light-dark() */
    --card-bg: light-dark(var(--card-bg-light), var(--card-bg-dark));
    --card-text: light-dark(var(--card-text-light), var(--card-text-dark));

  /* 3. Apply custom properties on relevant properties values */
  
  background-color: var(--card-bg);
  /* **Mandatory**: Dynamic built-in properties that inherit (like color and accent-color) and are set with light-dark() must be applied on the element where the scheme changes. 
  */
  color: var(--card-text);
  padding: 1.5rem;
  border-radius: 8px;
}
```

### 4. Create theme overrides
Force a component instance into a specific theme by setting its `color-scheme` property. This allows the component to ignore the global system preference.

```css
/* Force this specific card into dark mode */
.themed-card.force-dark {
  /* Dynamic custom properties don't need to be reapplied here since they were already defined on `.themed-card` */
  /* **Mandatory**: force component to use a particular color mode */
  color-scheme: dark;
}

/* Force this specific card into light mode */
.themed-card.force-light {
  /* Dynamic custom properties don't need to be reapplied here since they were already defined on `.themed-card` */
   /* **Mandatory**: Force component to use a particular color mode */
  color-scheme: light;
}
```

## Critical Considerations

- **The `@property` Risk**:
  - **Mandatory**: Do not register properties meant to be design tokens that dynamically switch based on `light-dark()` as `<color>`. If you need to animate a color variable, use a separate property.
- **Mandatory**: Do not set `color-scheme` on elements without a background.
 {{ INCLUDE("../browser-ui-color-theme/guide.md#best-practices") }}

## Fallback strategies

{{ BASELINE_STATUS("light-dark") }}
{{ BASELINE_STATUS("color-scheme") }}

- **Non-Color Properties**: Currently, `light-dark()` only supports color values. For other properties (like `padding` or `border-width`), you must continue using standard media queries or CSS Style Queries.
- **Progressive Enhancement**: Browsers that do not support `color-scheme` will ignore this property and use their default light-mode UI.
- **Handling `light-dark()` Support**: For browsers that support `color-scheme` but not yet `light-dark()`, light and dark versions of colors should first be defined as custom properties, and the `prefers-color-scheme` media query should be used to set colors for the respective mode like in the example below:

```css
.themed-card {
  /* 1. Define raw brand colors */
  --card-bg-light: #ffffff;
  --card-bg-dark: #2d2e31;
  --card-text-light: #202124;
  --card-text-dark: #f8f9fa;

  /* 2. Assign default (light) values */
  --card-bg: var(--card-bg-light);
  --card-text: var(--card-text-light);

  /* 3. Apply custom properties on relevant properties (light) values */
  
  background-color: var(--card-bg);
    /* **Mandatory**: Dynamic built-in properties that inherit (like color and accent-color) and are set with light-dark() must be applied on the element where the scheme changes. 
  */
  color: var(--card-text);
  padding: 1.5rem;
  border-radius: 8px;
}

/* 3. Fallback for browsers without light-dark() support but with prefers-color-scheme */
@media (prefers-color-scheme: dark) {
  .themed-card {
    --card-bg: var(--card-bg-dark);
    --card-text: var(--card-text-dark);
  }
}

/* 4. Modern enhancement using light-dark() */
@supports (color: light-dark(white, black)) {
  .themed-card {
    --card-bg: light-dark(var(--card-bg-light), var(--card-bg-dark));
    --card-text: light-dark(var(--card-text-light), var(--card-text-dark));
  }
}

/* 5. Force a component into a specific color-scheme */
.themed-card.force-dark { 
  color-scheme: dark;
}
```
