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
  - https://github.com/w3c/csswg-drafts/issues/13836
---

# Component-Specific Light/Dark Themes

The `light-dark()` function allows you to define two colors for a single property, which the browser automatically switches based on the current `color-scheme`. By scoping both the `light-dark()` variables and the `color-scheme` property to a specific component, you can create UI elements that can be independently forced into light or dark mode, regardless of the user's global system preference.

## Why use component-specific themes?

While most applications should follow the user's system preference by default, there are several scenarios where you need more granular control over an element's theme:

- **Nested UI Contexts ("Theme Islands")**: You may want to create sections of a page that contrast with the global theme, such as a dark footer or sidebar on an otherwise light-themed website.
- **Content-Driven Aesthetics**: Certain components work best in a specific mode. For example, **code editors**, **video players**, and **photo galleries** often use dark themes to minimize distraction and make colors "pop," regardless of the user's OS setting.
- **User Preference Overrides**: You can empower users to manually toggle the theme of a specific workspace or widget. This allows them to choose a mode that fits their environment or eye comfort without forcing them to change their global operating system settings.
- **Native Browser UI Consistency**: By forcing a specific `color-scheme` on a container, you ensure that all built-in browser UI within that container—such as **scrollbars**, **form controls**, and **dropdown menus**—automatically match the intended theme of that component.

## When to Change Colors vs. When to Force `color-scheme`

### 1. Change Colors when:
*   You only need to update certain properties of author styled elements (like the background of a `<div>` or the color of an `<h1>`).
*   The component doesn't contain any "native" interactive parts.
*   **Result:** Only the parts you explicitly styled will change.

### 2. Force `color-scheme` when:
*  The component has built-in browser features like **scrollbars** (e.g., a scrollable code block or sidebar) or **form controls** (like `<select>` menus, checkboxes, or date pickers).
*  The component is best viewed in a particular color mode. 
*   **Result:** The browser automatically themes the "hidden" parts you can't easily reach with CSS, or the component keeps its preferred color mode regardless of the user's color scheme preference. 

## Implementation Steps

### 1. Declare supported schemes in HTML
MANDATORY: To help prevent a "flash of un-themed content" (FOUC), place a `<meta>` tag in your `<head>` to ensure the browser knows which themes you support before it even starts rendering. While this `<meta>` tag helps to avoid FOUC by setting the initial canvas color early, it may not completely eliminate flashes in all browsers or loading conditions.

```html
<!-- MANDATORY: Declare support for both light and dark themes -->
<meta name="color-scheme" content="light dark">
```

### 2. Enable `color-scheme` support
MANDATORY: Enable global support for both color schemes by setting `color-scheme: light dark;` on the `:root`. If `color-scheme` is not set on `:root` (or an ancestor) the `light-dark()` function will not work as expected.

```css
:root {
  /* **Mandatory:** Enable global support for both color schemes */
  color-scheme: light dark;
}
```

### 3. Define theme-aware variables
Using custom properties creates a **semantic abstraction layer** for your component's theme. This allows your styling to remain constant while the *values* of your variables adapt to the theme context. It also simplifies fallback management and provides the essential mechanism for re-resolving values in nested "theme islands" to avoid inheritance issues without repeating complex logic on every property.

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
  
    /* **Mandatory**: when nesting schemes, dynamic properties set with 
    light-dark() must also be set on the element where the scheme changes. 

    When setting a different color-scheme on a component, **DO NOT** redefine custom properties (e.g. --accent-color: light-dark(black, white);) 
    unless the custom property needs to be updated. The custom property only needs 
    to be applied to a property (e.g. accent-color: var(--accent-color);).
  */
  background-color: var(--card-bg);
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
```

### 4. Create theme overrides
Force a component instance into a specific theme by setting its `color-scheme` property. This allows the component to ignore the global system preference.

```css
/* Force this specific card into dark mode */
.themed-card.force-dark {
  /* Dynamic custom properties don't need to be reapplied here since they were already defined on `.themed-card` */
  color-scheme: dark;
}

/* Force this specific card into light mode */
.themed-card.force-light {
  /* Dynamic custom properties don't need to be reapplied here since they were already defined on `.themed-card` */
  color-scheme: light;
}
```

## Critical Considerations: The "Inheritance Footgun"

`light-dark()` currently resolves based on the `color-scheme` of the element where the variable is **defined**, not where it is **used**.

### The Problem
If you define a variable on the `:root`, the browser resolves it to a specific color (e.g., the light version) immediately. Descendant elements that change their `color-scheme` will inherit the *already-resolved color* rather than re-resolving the `light-dark()` function.

- **Example: Handling Resolution Gaps**
  ```css
  /* ⚠️ PROBLEM: Variable resolves at :root (light) and stays 'yellow' */
  :root {
    color-scheme: light dark;
    --color-accent: light-dark(yellow, blue);
  }

  /* ❌ FAILURE: The card remains yellow even in dark mode */
  .dark-section {
    color-scheme: dark;
  }
  .dark-section .card {
    background-color: var(--color-accent); 
  }

  /* ✅ FIX: Reapply the token where the scheme changes (e.g. background-color: var(--color-accent), **Not** `--color-accent: light-dark(black, white);`) */
  .dark-section {
    color-scheme: dark;
    background-color: var(--color-accent); /* Forces re-resolution */
  }
  ```

### Avoid `@property` registration
MANDATORY: Do not use registered custom properties (via `@property`) for colors intended to resolve via `light-dark()`. Registered properties "lock" their resolved value at computed value time even more strictly, making them non-reactive to local theme changes in almost all scenarios.

See {{ GUIDE_REF("browser-ui-color-theme") }} for more on handling **Token Resolution and Inheritance** and dealing with **The `@property` Risk** when changing the color scheme of a component that relies on properties set with `light-dark()`.

## Fallback strategies

{{ BASELINE_STATUS("light-dark") }}
{{ BASELINE_STATUS("color-scheme") }}

- **Progressive Enhancement**: Always use the `@supports` pattern shown in Step 1. This ensures that browsers supporting `color-scheme` but not `light-dark()` still receive the correct theme via media queries, while modern browsers gain the benefit of per-component overrides.
- **Non-Color Properties**: Currently, `light-dark()` only supports color values. For other properties (like `padding` or `border-width`), you must continue using standard media queries or CSS Style Queries.
