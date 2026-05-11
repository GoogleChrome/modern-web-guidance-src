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
pre, code {
  /* Forces element and its children to use dark themed UI */
  color-scheme: dark;
}
```

### 4. OPTIONAL: Fine-grained control with custom properties and `light-dark()`
For more control over the colors of built-in UI such as `accent-color` or `scrollbar-color`, authors **can optionally** add their own dynamic colors with use of custom properties and/or the `light-dark()` function. This function automatically picks the correct color based on the computed `color-scheme` of the element and eliminates the need for redundant media queries, but is not required for a basic implementation.

```css
:root {
  /* Define browser UI accent color for each mode */
  --brand-accent-light: #0056b3; /* Deep blue for light mode */
  --brand-accent-dark: #00e5ff;  /* Bright cyan for dark mode */
  

  /* Define colors for other parts of the theme */
  --brand-bg-light: hsl(0, 0%, 100%);
  --brand-bg-dark: hsl(212, 33%, 10%);

  --brand-text-light: hsl(210, 100%, 2%);
  --brand-text-dark: hsl(0, 0%, 100%);

  /* Optional: Use light-dark() for more control of built-in UI colors */
  --background-color: light-dark(var(--brand-bg-light), var(--brand-bg-dark));
  --text-color: light-dark(var(--brand-text-light), var(--brand-text-dark));

  /* Set dynamic browser UI accent color for each mode */
  --accent-color: light-dark(var(--brand-accent-light), var(--brand-accent-dark));

  /* MANDATORY: Automatically adapt native UI to user system preferences */
  color-scheme: light dark;
}

body {
  background-color: var(--background-color);
  color: var(--text-color);
  /* Apply custom accent color to UI elements*/
  accent-color: var(--accent-color);
}

pre, code {
  /* Apply dark scheme to built-in UI elements */
  color-scheme: dark;
  /* **Mandatory**: when nesting schemes, dynamic built-in inherited properties (e.g. color, accent-color) set with 
    light-dark() must also be set on the element where the scheme changes. 

    When setting a different color-scheme on a component, **DO NOT** redefine custom properties (e.g. --accent-color: light-dark(black, white);) 
    unless the custom property needs to be updated. The custom property only needs 
    to be applied to a property (e.g. accent-color: var(--accent-color);).
  */
  accent-color: var(--accent-color);
  /* Set colors for other theme styles */
  background-color: var(--background-color);
  color: var(--text-color);
}
```

## Best Practices
  - The `@property` Risk **:
    - **Mandatory**: Do not register properties meant to be design tokens that dynamically switch based on `light-dark()` as `<color>`. If you need to animate a color variable, use a separate property. `light-dark()` resolves at computed value time, and registered properties inherit resolved, computed values, so the color would no longer be reactive to local theme changes. Descendant elements that change their `color-scheme` (e.g., a dark-themed card on a light page) will inherit the *already-resolved color* instead of the dynamic function.
    - Built-in inherited properties such as `color` and `accent-color` can also be affected by this issue. To prevent this, always reassign the dynamic theme variable on these built-in properties when they are inside of a nested theme. 
    - **Example: Handling Built-In Inherited Properties**

      ```css
      :root {
        /* Define browser UI accent color for each mode */
        --brand-accent-light: #0056b3;
        --brand-accent-dark: #00e5ff;
        /* OPTIONAL: Apply dynamic color switching based on light-dark */
        --accent-color: light-dark(var(--brand-accent-light), var(--brand-accent-dark));

        /* MANDATORY: Automatically adapt native UI to user system preferences */
        color-scheme: light dark;
        /* Set built-in inherited property */
        accent-color: var(--accent-color);
        }

      textarea {
        color-scheme: dark;
        /* **Mandatory**: when nesting schemes, dynamic values set with light-dark() on built-in inherited properties must also be re-assigned on the element where the scheme changes */
        accent-color: var(--accent-color); 
      }
     ```
- **System Colors**: Use system color keywords like `Canvas` (background) and `CanvasText` (text) for your custom components when you want them to match the browser's native themed surfaces exactly. This is ideal for ensuring consistency between your content and the browser's UI (like scrollbars) while automatically respecting OS-level accessibility features like High Contrast mode.
- **Respect User Preference**: **MANDATORY**: Avoid forcing a single theme on the overall page. While specific components (like a code editor) may benefit from a fixed theme, the main application should respect the user's system preference and ideally provide a manual toggle to allow users to choose between light, dark, or system-default modes.
- **Forcing a Theme**: Use a single value like `color-scheme: dark` or `color-scheme: light` ONLY for specific sections of your site (like a code editor or a video player) that must remain in one theme. Avoid applying this to the root element unless it's the result of an explicit user selection via a theme toggle.
- **Opting out of Auto-Dark Mode**: Use `color-scheme: only light` to prevent browsers (particularly on mobile) from automatically inverting your colors if you haven't yet implemented a dedicated dark theme or prefer not to show the component with a dark theme.

## Fallback strategies

{{ BASELINE_STATUS("color-scheme") }}
{{ BASELINE_STATUS("light-dark") }}

- **Progressive Enhancement**: Browsers that do not support `color-scheme` will ignore this property and use their default light-mode UI.
- **Handling `light-dark()` Support**: For browsers that support `color-scheme` but not yet `light-dark()`, light and dark versions of colors should first be defined as custom properties, and the `prefers-color-scheme` media query should be used to set colors for the respective mode like in the example below:

```css
:root {
  /* Define browser UI accent color for each mode */
  --brand-accent-light: #0056b3;
  --brand-accent-dark: #00e5ff;
  --accent-color: var(--brand-accent-light, AccentColor);

  /* MANDATORY: Automatically adapt native UI to user system preferences */
  color-scheme: light dark;
  /* Set accent color */
  accent-color: var(--accent-color);

  /* MANDATORY: Fallback for browsers without light-dark support */
  @media (prefers-color-scheme: dark) {
    --accent-color: var(--brand-accent-dark);
  }

  /* OPTIONAL: use light-dark() for more control of built-in UI colors */
  @supports (color: light-dark(white, black)) {
    --accent-color: light-dark(var(--brand-accent-light), var(--brand-accent-dark));
  }
}

textarea {
  color-scheme: dark;
  /* **Mandatory**: when nesting schemes, dynamic values set with light-dark() used in inherited properties must also be re-assigned on the element where the scheme changes */
  accent-color: var(--accent-color); 
}
```
- **Manual Dark Mode Styling**: For older browsers, continue to use `prefers-color-scheme` media queries to provide custom styles for your own components.
- **Custom Scrollbars**: If you need consistent scrollbar styling across all modern browsers, use the `scrollbar-color` property. For older WebKit-based browsers that do not support the standard property, continue to use the non-standard `::-webkit-scrollbar` pseudo-elements.
