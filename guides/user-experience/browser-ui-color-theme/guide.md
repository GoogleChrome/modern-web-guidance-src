---
name: browser-ui-color-theme
description: Configure built-in browser UI (e.g. scrollbars, form controls, etc) to respect the user's light/dark theme preference.
web-feature-ids:
- color-scheme
- prefers-color-scheme
- light-dark
- accent-color
sources:
  - https://web.dev/articles/baseline-in-action-color-theme
  - https://web.dev/articles/color-scheme
  - https://web.dev/learn/design/media-features?hl=en#setting_the_color_scheme_for_ui_elements
  - https://web.dev/articles/building/a-theme-switch-component
  - https://drafts.csswg.org/css-color-adjust/#color-scheme-prop
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme
  - https://css-tricks.com/almanac/properties/c/color-scheme/
  - https://blog.jim-nielsen.com/2020/color-scheme-property/
  - https://web.dev/articles/building/a-color-scheme
  - https://web.dev/articles/accent-color
---

# Browser UI color theme

The `color-scheme` property indicates which color schemes (such as light or dark) your page supports. This informs the browser that it can automatically theme native UI elements—like scrollbars, form controls, and the default canvas background—to match your site's design and help minimize white flashes during initial loading.

## Implementation

### 1. Declare supported schemes in HTML
MANDATORY: To help prevent a "flash of un-themed content" (FOUC), place a `<meta>` tag in your `<head>` to ensure the browser knows which themes you support before it even starts rendering. While this `<meta>` tag helps to avoid FOUC by setting the initial canvas color early, it may not completely eliminate flashes in all browsers or loading conditions.

```html
<!-- MANDATORY: Declare support for both light and dark themes -->
<meta name="color-scheme" content="light dark">
```

### 2. Apply theme to CSS :root or html
MANDATORY: Apply the `color-scheme` property to the `html` element or the `:root` pseudo-class. Browsers specifically look to the root element to determine the theme for the entire viewport—including the root scrollbars and the initial "canvas" background. If applied only to the `body`, these global UI surfaces may remain in light mode because the `body` does not control the window's rendering context.

```css
/* MANDATORY: Apply to :root or html for viewport-wide theming */
:root {
  /* MANDATORY: Automatically adapt native UI to user system preferences */
  color-scheme: light dark;
}
```

### 3. Component-Specific Overrides
You can override the global theme for specific elements. This is useful for "dark mode" sections within a light-themed site (e.g., a dark sidebar or a code editor).

```css
.dark-sidebar {
  /* Force this element and its children to use dark themed UI */
  color-scheme: dark;
  background-color: #111;
  color: #eee;
}
```

### 4. Fine-grained control with `light-dark()`
For more control over the colors of built-in UI such as `accent-color` or `scrollbar-color`, use the `light-dark()` function. This function automatically picks the correct color based on the computed `color-scheme` of the element and eliminates the need for redundant media queries.

```css
:root {
  /* Define browser UI accent color for each mode */
  --accent-color-dark: #0056b3;
  --accent-color-light: #00e5ff;
  --accent-color: var(--accent-color-dark);

  /* MANDATORY: Automatically adapt native UI to user system preferences */
  color-scheme: light dark;
  /* Set accent color */
  accent-color: var(--accent-color);

  /* MANDATORY: Fallback for browsers without light-dark support */
  @media (prefers-color-scheme: dark) {
    --accent-color: var(--accent-color-light);
  }

  /* Set browser UI accent color for each mode */
  @supports (color: light-dark(white, black)) {
    /* Blue in light mode, Cyan in dark mode */
    --accent-color: light-dark(var(--accent-color-dark), var(--accent-color-light));
  }
}
```

## Best Practices
  - **Token Resolution and Inheritance**: Be aware that `light-dark()` currently resolves based on the `color-scheme` of the element where the value is **defined**, not where it is **used**.
  - **The "Inheritance Footgun"**: If you define a theme variable on the `:root`, the browser resolves it to a specific color immediately. Descendant elements that change their `color-scheme` (e.g., a dark-themed card on a light page) will inherit the *already-resolved color* instead of the dynamic function.
  - **The `@property` Risk**: This issue is particularly critical when using registered custom properties (via `@property`). Because these have a defined `syntax: "<color>"`, they "lock" the resolved color at computed value time, making them non-reactive to local theme changes.
  - **The Workaround**: For components that might exist in "nested" themes, you must currently redefine your tokens locally whenever you change the `color-scheme`.
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

  /* ✅ FIX: Redefine the token where the scheme changes */
  .dark-section {
    color-scheme: dark;
    background-color: var(--color-accent); /* Forces re-resolution */
  }
  ```

- **System Colors**: Use system color keywords like `Canvas` (background) and `CanvasText` (text) for your custom components when you want them to match the browser's native themed surfaces exactly. This is ideal for ensuring consistency between your content and the browser's UI (like scrollbars) while automatically respecting OS-level accessibility features like High Contrast mode.
- **Respect User Preference**: **MANDATORY**: Avoid forcing a single theme on the overall page. While specific components (like a code editor) may benefit from a fixed theme, the main application should respect the user's system preference and ideally provide a manual toggle to allow users to choose between light, dark, or system-default modes.
- **Forcing a Theme**: Use a single value like `color-scheme: dark` or `color-scheme: light` ONLY for specific sections of your site (like a code editor or a video player) that must remain in one theme. Avoid applying this to the root element unless it's the result of an explicit user selection via a theme toggle.
- **Opting out of Auto-Dark Mode**: Use `color-scheme: only light` to prevent browsers (particularly on mobile) from automatically inverting your colors if you haven't yet implemented a dedicated dark theme.

## Fallback strategies

{{ BASELINE_STATUS("color-scheme") }}
{{ BASELINE_STATUS("light-dark") }}

- **Progressive Enhancement**: Browsers that do not support `color-scheme` or `light-dark()` will simply ignore these properties and use their default light-mode UI.
- **Handling `light-dark()` Support**: For browsers that support `color-scheme` but not yet `light-dark()`, light and dark versions of colors should first be defined as custom properties, and the `prefers-color-scheme` media query should be used to set colors for the respective mode like in the example below:

```css
.themed-card {
  /* Define browser UI accent color for each mode */
  --card-bg-light: #ffffff;
  --card-bg-light: #2d2e31;
  --card-text-dark: #202124;
  --card-text-dark: #f8f9fa;

  --card-bg: var(--card-bg-light);
  --card-text: var(--card-text-light);
}

/* Fallback for browsers without light-dark support */
@media (prefers-color-scheme: dark) {
  .themed-card {
    --card-bg: var(--card-bg-dark);
    --card-text: var(--card-text-dark);
  }
}

/* Set color for each mode */
@supports (color: light-dark(white, black)) {
  .themed-card {
    --card-bg: light-dark(var(--card-bg-light), var(--card-bg-dark));
    --card-text: light-dark(var(--card-text-light), var(--card-text-dark));
  }
}
```
- **Manual Dark Mode Styling**: For older browsers, continue to use `prefers-color-scheme` media queries to provide custom styles for your own components.
- **Custom Scrollbars**: If you need consistent scrollbar styling across all modern browsers, use the `scrollbar-color` property. For older WebKit-based browsers that do not support the standard property, continue to use the non-standard `::-webkit-scrollbar` pseudo-elements.
