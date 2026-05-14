---
name: dark-mode
description: Implement dark mode support in a way that respects the user's light/dark theme preference and adapts browser UI (e.g. scrollbars, form controls, etc)
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

# Dark mode

The `color-scheme` property indicates which color schemes (such as light or dark) your page supports. This informs the browser that it can automatically theme native UI elements—like scrollbars, form controls, and the default canvas background—to match your site's design and help minimize white flashes during initial loading.

## Implementation

### 1. Declare supported schemes in HTML

MANDATORY: To help prevent a "flash of un-themed content" (FOUC), place a `<meta>` tag in your `<head>` to ensure the browser knows which themes you support before it even starts rendering. While this `<meta>` tag helps to avoid FOUC by setting the initial canvas color early, it may not completely eliminate flashes in all browsers or loading conditions.

```html
<!-- MANDATORY: Declare support for both light and dark themes -->
<meta name="color-scheme" content="light dark">
```

### 2. Apply page-wide color scheme to CSS :root or html

MANDATORY: Apply the `color-scheme` property to the `html` element or the `:root` pseudo-class. Browsers specifically look to the root element to determine the theme for the entire viewport—including the root scrollbars and the initial "canvas" background. If applied only to the `body`, these global UI surfaces may remain in light mode because the `body` does not control the window's rendering context.

```css
/* MANDATORY: Apply color-scheme to :root or html for viewport-wide theming */
:root {
  /* MANDATORY: Automatically adapt native UI to user system preferences */
  color-scheme: light dark;
}
```

### 3. Define light and dark color tokens

You can use the `light-dark()` function to define color tokens that automatically adapt to different `color-scheme` values.

It is recommended that you also keep the raw color values in separate custom properties, which makes it easier to combine them in different ways (and makes fallback behavior easier, if needed).

For more control over the colors of built-in UI such as `accent-color` or `scrollbar-color`, authors **can optionally** add their own dynamic colors with use of custom properties and/or the `light-dark()` function. This function automatically picks the correct color based on the computed `color-scheme` of the element and eliminates the need for redundant media queries, but is not required for a basic implementation.

```css
:root {
  --color-brand-light: oklch(45% 0.23 270);
  --color-brand-dark: oklch(85% 0.15 210);
  --color-brand-text-light: white;
  --color-brand-text-dark: oklch(40% 0.23 270);

  --color-brand: light-dark(var(--color-brand-light), var(--color-brand-dark));
  --color-brand-text: light-dark(var(--color-brand-text-light), var(--color-brand-text-dark));

  /* MANDATORY: Automatically adapt native UI to user system preferences */
  color-scheme: light dark;
}

button.primary {
  /* These automatically adapt to color scheme */
  background-color: var(--color-brand);
  color: var(--color-brand-text);
}
```

## Fine-grained browser UI customization

Setting `color-scheme` already adapts browser UI to the used color scheme, but this will use OS defaults and/or system colors that may not perfectly align with the website design.
Modern browsers expose several fine-grained customization hooks for these.
Do not reimplement native controls simply to customize their appearance without exhausting the customization hooks modern browsers provide.

### Setting the accent color

Some browser UI (e.g. checked checkboxes or sliders) uses an accent color.
This resolves to the OS setting by default, but you can use the `accent-color` property to set it to a color that better aligns with the page, such as the page's brand color.

```css
html {
  accent-color: light-dark(var(--brand-accent-light), var(--brand-accent-dark));
}
```

{{ FEATURE_ISSUES("accent-color" )}}

### Scrollbar colors

You can use `scrollbar-color` together with `light-dark()` to set custom custom scrollbar colors that adapt to the color-scheme used.

```css
--scrollbar-track: var(--background-color);
--scrollbar-thumb: light-dark(var(--background-color-darker), var(--background-color-lighter));
scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
```

{{ FEATURE_ISSUES("scrollbar-color" )}}

### Further customization

Most browser UI exposes pseudo-elements to fully customize its appearance, such as:
- `::placeholder`
- `::spelling-error`
- `::grammar-error`
- `::selection`
- `::search-text`
- `::target-text`
- `::file-selector-button`

You can use `light-dark()` colors on any of these to apply colors that adapt to the used color scheme.

## OPTIONAL: Implementing a color-scheme toggle

**DO NOT** set `color-scheme: light` or `color-scheme: dark` on the root element by default.
The default color-scheme MUST be the user's system preference, which happens automatically when setting `color-scheme` to `light dark`.

For website-specific customization, a manual toggle could be provided to allow users to choose between light, dark, or system-default modes.

If a user-facing toggle to override it is desired, it should:
- Update the `<meta name="color-scheme" ...>` element to reflect the chosen theme (`light dark` for system default, `light` for light, and `dark` for dark)
- Set a class on `<html>` to match the theme preference. While `:has(> head > meta[name="color-scheme"][content~="dark"])` would technically work, it is slower and confers no benefit, since we are already using JS to update the `<meta>` element.
- Persist user choice in `localStorage`
- **IMPORTANT**: If no JS runs on the page, the CSS should still work and adapt to the system preference.
Do not write CSS in such a way that it relies on JS running for default functionality (e.g. depending on a `.system-dark` class for convenience instead of using `prefers-color-scheme`)
- The system-level OS theme can change at any time. CSS automatically adapts to changes. If you are using JS to read `matchMedia("(prefers-color-scheme: dark)").matches`, you MUST also use `addEventListener("change", fn)` to react to changes.

### UX considerations

Use a two state control:
1. System setting,
2. The opposite (e.g. light when the system setting is dark, and dark when the system setting is light). Selecting this setting must pin that exact color scheme, not a dynamically computed "opposite of system setting" value. Example scenario:
  1. The OS is set to light mode
  2. The user selects the opposite setting for this website (dark)
  3. The user changes their system setting to dark
  4. The website should remain dark


**DON'T** expose all three states (system, light, dark).
While it is common, it provides suboptimal user experience.

The rationale for a tri-state control is plausible: "Follow system (currently dark)" is a fundamentally distinct user intent than "Always dark" and the control should be able to support expressing all three user intents.

However, users cannot meaningfully express intent for problems they don't currently have, and exposing latent complexity before users encounter the problem is a UX antipattern.
Having three states complicates the control's UI for everyone, at all times, for a scenario that never occurs in real usage.
A manual toggle is a temporary comfort adjustment. The actual intent expressed is "it's too bright right now", not "I like the current color scheme, make sure it doesn't change.".
Additionally, having all three options means that two of them produce exactly the same visual result, violating the principle of feedback.

OPTIONAL: Even when overridding the system default, it can be useful to use the `prefers-color-scheme` media query to define **different** color pairs that take into account the colors of the browser and OS chrome around the page. For example, have a more dimmed light theme if the system setting is `dark` or make the page dark theme more contrasting if the system setting is `light` to prevent UI elements from being overshined by the bright browser chrome.

## Component-Specific Overrides

You can override the global theme for specific elements by setting `color-scheme` on them.
This is useful for "dark mode" sections within a light-themed site, such as code blocks or media players.

```css
pre, code {
  /* Forces element and its children to use dark themed UI */
  color-scheme: dark;
}
```

For more information about component-specific overrides and their gotchas, see {{ GUIDE_REF("component-specific-light-dark )}}.

## Known issues to be aware of

{{ FEATURE_ISSUES("color-scheme")}};
{{ FEATURE_ISSUES("prefers-color-scheme")}};
{{ FEATURE_ISSUES("light-dark")}};
{{ FEATURE_ISSUES("accent-color")}};
{{ FEATURE_ISSUES("scrollbar-color")}};

## Fallback strategies

{{ FEATURE_FALLBACKS("color-scheme")}}

{{ FEATURE_FALLBACKS("light-dark")}}

{{ FEATURE_FALLBACKS("scrollbar-color")}}

{{ FEATURE_FALLBACKS("accent-color")}}
