---
name: browser-ui-color-theme
description: Configure built-in browser UI (e.g. scrollbars, form controls, etc) to respect the user's light/dark theme preference.
web-feature-ids:
  - color-scheme
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
---

# Browser UI color theme

The `color-scheme` property indicates which color schemes (such as light or dark) your page supports. This informs the browser that it can automatically theme native UI elements—like scrollbars, form controls, and the default canvas background—to match your site's design and help minimize white flashes during initial loading.

## Implementation

### 1. Declare supported schemes in HTML
MANDATORY: Place a `<meta>` tag in your `<head>` to ensure the browser knows which themes you support before it even starts rendering. While this is the most effective way to reduce the "flash of un-themed content" (FOUC) by setting the initial canvas color early, it may not completely eliminate flashes in all browsers or loading conditions.

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

## Best Practices
- **System Colors**: Use system color keywords like `Canvas` (background) and `CanvasText` (text) for your custom components when you want them to match the browser's native themed surfaces exactly. This is ideal for ensuring consistency between your content and the browser's UI (like scrollbars) while automatically respecting OS-level accessibility features like High Contrast mode.
- **Forcing a Theme**: Use a single value like `color-scheme: dark` or `color-scheme: light` if a specific section of your site (like a code editor or a video player) must always remain in one theme regardless of system settings. This is also common when your application implements a manual theme toggle that overrides the user's OS preference by dynamically updating the root element's style.
- **Opting out of Auto-Dark Mode**: Use `color-scheme: only light` to prevent browsers (particularly on mobile) from automatically inverting your colors if you haven't yet implemented a dedicated dark theme.

## Fallback strategies

{{ BASELINE_STATUS("color-scheme") }}

- **Progressive Enhancement**: Browsers that do not support `color-scheme` will simply ignore the property and use their default light-mode UI.
- **Manual Dark Mode Styling**: For older browsers, continue to use `prefers-color-scheme` media queries to provide custom styles for your own components.
- **Custom Scrollbars**: If you need consistent scrollbar styling across all modern browsers, use the `scrollbar-color` property. For older WebKit-based browsers that do not support the standard property, continue to use the non-standard `::-webkit-scrollbar` pseudo-elements.
