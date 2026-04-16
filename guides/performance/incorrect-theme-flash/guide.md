---
name: prevent-incorrect-theme-flash
description: Prevent a flash of the incorrect color theme before page styles are loaded, for example a flash of a white background before the dark theme CSS is applied.
web-feature-ids:
  - color-scheme
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme
  - https://web.dev/color-scheme/
  - https://css-tricks.com/flash-of-inaccurate-color-theme-fart/
  - https://css-tricks.com/a-complete-guide-to-dark-mode-on-the-web/
---

To prevent a flash of incorrect color theme (often called "Flash of inAccurate coloR Theme" or **FART**), you must inform the browser about the supported color schemes as early as possible. This allows the browser to render the initial background and system colors according to the user's preference before any CSS is fully parsed or applied.

While the `color-scheme` feature handles the **system preference** perfectly, many sites also allow a **user-selected override** (e.g., a theme toggle). If the user's manual preference differs from their system setting, you must apply that override immediately to avoid a visual flash.

The recommended approach uses both a `<meta name="color-scheme">` tag for the fastest possible hint and the `color-scheme` CSS property for ongoing style consistency.

### Implementation steps

1. **Add the meta tag (MANDATORY)**: Place a `<meta name="color-scheme">` tag as the very first element in your `<head>`. This ensures the browser sees it immediately, even before it starts fetching external stylesheets.

```html
<head>
  <!-- Place this as high as possible to hint the browser immediately -->
  <meta name="color-scheme" content="light dark">
  ...
</head>
```

2. **Handle User Overrides (Optional)**: If you provide a theme toggle that persists (e.g., in `localStorage`), place a small, blocking `<script>` immediately after the `<meta>` tag. This script should check for a saved preference and apply a corresponding class to the `<html>` element.

```html
<head>
  <meta name="color-scheme" content="light dark">
  <script>
    // Check for user-selected theme override immediately to avoid "FART"
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.documentElement.classList.add(savedTheme + '-theme');
    }
  </script>
</head>
```

3. **Define CSS color-scheme (MANDATORY)**: Set the `color-scheme` property on the `:root` element (or `html`) to match your supported themes. This ensures that system-provided UI elements (like scrollbars and form controls) and the default canvas color match the theme.

```css
:root {
  /* This ensures the browser's default styles (background, text)
     align with the user's preferred scheme immediately. */
  color-scheme: light dark;
}
```

4. **Opt-in for specific elements (Optional)**: If specific parts of your application only support one theme, you can override the `color-scheme` CSS property for those elements.

```css
.always-light {
  /* This CSS property override only affects the element and its descendants */
  color-scheme: light;
}
```

### Key nuances and gotchas

- **Fastest hint wins**: While both the `<meta name="color-scheme">` tag and the `color-scheme` CSS property on `:root` achieve the same end state, the meta tag is prioritized for the initial render. Browsers use the meta tag to decide the background color of the "canvas" before they have even finished parsing the CSS.
- **Inheritance**: The `color-scheme` CSS property is inherited. You can create "themed islands" within your page by applying the property to a container. This will automatically adjust the native scrollbars and form controls within that container to match.
- **Root vs. Elements**: Only the `color-scheme` CSS property applied to the root element (`html`) or provided via the `<meta name="color-scheme">` tag affects the entire viewport's background color and the primary scrollbar. Applying the CSS property to a `<div>` only affects that element's internal system styles.
- **Overrides**: If the `<meta name="color-scheme">` tag and the `color-scheme` CSS property on `:root` disagree, the CSS property will eventually take precedence once loaded, but this can lead to a secondary flash or shift if they aren't kept in sync. Always ensure they match.
- **"Dark-mode first" safety**: A flash of white in a dark room is significantly more jarring than a flash of dark in a bright room. If your app is heavily used in dark mode, consider setting a dark background color as a default inline style to mitigate the worst-case "blinding" flash if other hints are delayed.

### Fallback strategies

{{ BASELINE_STATUS("color-scheme") }}

If the browser does not support the `color-scheme` feature, it will default to its standard behavior (usually a light theme). To provide a fallback experience:

1. **Feature Detection**: You can check for support of the CSS property or meta tag in CSS or JavaScript.

```css
/* Check for support if you need to apply complex fallbacks */
@supports (color-scheme: light dark) {
  /* Modern behavior is handled automatically */
  :root {
    color-scheme: light dark;
  }
}

@media (prefers-color-scheme: dark) {
  :root {
    /* Manual fallback for older browsers if they support media queries but not color-scheme */
    background-color: #121212;
    color: white;
  }
}
```

2. **Graceful Degradation**: Browsers that don't support `color-scheme` will simply ignore the meta tag and the CSS property. The page will still load, but users might experience a brief flash of white before your custom dark theme CSS loads and is applied.
