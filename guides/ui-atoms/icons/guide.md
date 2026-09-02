---
name: icons
description: Display and manage icons that can be set and parameterized from CSS, are fast to load, crisp at any resolution and are properly exposed to (or hidden from) assistive technologies.
web-feature-ids:
  - svg
  - masks
  - image-set
  - container-style-queries
  - registered-custom-properties
  - tmp-linked-parameters
guides:
  - precise-text-alignment
---

# SVG Icon Implementation

Modern icon systems prioritize performance, accessibility, and themeability. While several techniques exist for displaying SVGs, the choice depends on whether the icon needs deep styling (multi-color/animation) or if it can be treated as a cachable, single-color asset.

Example use cases include:
- Interactive UI controls (buttons, toggles, navigation)
- Information indicators (status badges, alerts, tooltips)
- Decorative brand elements and illustrations
- Dense data visualizations and dashboards where performance is critical

## Choosing the right technique

Choosing the best SVG implementation is a balance between color control, performance, and accessibility. Use this decision tree to find the right approach:

1.  **Do you need to animate internal paths or use multiple colors in a single icon?**
    *   **Yes**: Use **Inline SVG**. This is the only way to gain full DOM access to the icon's internals.
    *   **No**: Proceed to step 2.
2.  **Is browser caching and performance your primary goal (e.g., a long list of icons)?**
    *   **Yes**: Keep the icon as an external file. Proceed to step 3.
    *   **No**: Use **Inline SVG**. It is the most robust and easiest to implement for general UI.
3.  **Do you need to dynamically change the icon's color via CSS?**
    *   **Yes**: Proceed to step 4.
    *   **No**: Use a **Plain `<img>`** tag. This is the fastest method for static icons.
4.  **Do you need to avoid extra markup or support older browsers?**
    *   **Yes**: Use **`<img>` + CSS filters**. It requires no wrapper and has excellent support, though color math is more complex.
    *   **No**: Use **CSS Masks**. It allows for clean color control via `background-color` and CSS variables.

### Comparison at a glance

| Technique | Color Control | Multi-color | Animatable | Extra Markup |
| :--- | :--- | :---: | :---: | :---: |
| **Inline SVG** | Full (CSS) | ✅ | ✅ | ❌ |
| **CSS Masks** | Full (Tint) | ❌ | ✅ | ⚠️ |
| **`<img>` + Filter** | Partial | ⚠️ | ✅ | ❌ |
| **Plain `<img>`** | None | ❌ | ❌ | ❌ |
| **Linked Params** | Full | ✅ | ⚠️ | ❌ |

## Basic implementation

### Inline SVG (Best for Control)

Inline SVGs are part of the DOM, making them highly themeable via `currentColor` and custom properties. This is often the best fit for frameworks like React or Vue.

```html
<svg class="icon icon--star" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path d="..." fill="currentColor" />
  <!-- Use variables for multi-color support -->
  <circle cx="12" cy="12" r="3" fill="var(--icon-accent, gold)" />
</svg>
```

### CSS Masks (Best for Performance)

Masks load an external file once and use `background-color` to "tint" the shape. This keeps the icon external and cachable.

```css
.icon {
  width: 24px;
  height: 24px;
  background-color: #666;
  mask-image: url("/icons/search.svg");
  mask-size: contain;
  mask-repeat: no-repeat;
}
```

### External Image with Filters

If you cannot use masks, you can tint external `<img>` tags using CSS `filter`.

```css
.icon--tinted {
  /* Tints a black SVG to a brand color */
  filter: invert(48%) sepia(79%) saturate(2476%) hue-rotate(86deg) brightness(118%) contrast(119%);
}
```

### Smooth Color Transitions (Registered Custom Properties)

Standard CSS custom properties cannot be animated/transitioned because the browser does not know their underlying type (they are treated as generic strings). To enable smooth color transitions (e.g., when hovering or focusing a button), register a custom property with a `<color>` type using `@property`.

```css
@property --icon-color {
  syntax: "<color>";
  inherits: true;
  initial-value: currentColor;
}

.icon {
  color: var(--icon-color);
  /* The browser can now interpolate --icon-color during transitions */
  transition: --icon-color 0.2s ease;
}

.icon--danger {
  --icon-color: #b00020;
}

button:hover .icon {
  --icon-color: hotpink;
}
```

## Best practices

- **DO** hide decorative icons from assistive technology using `aria-hidden="true"`. If the icon is the only content in a button, provide an accessible name via `aria-label` or an internal `<title>` with `role="img"`.
- **DO NOT** use icon fonts. They are less accessible, harder to align, and have worse rendering quality than SVGs.
- Use `image-set()` to provide high-resolution icon variants for different display densities when using external masks or images.
- Use registered custom properties and `@container style()` queries to manage icon "variants" (e.g., density or visual state) without coupling icons to specific parent classes.

## Known issues to be aware of

### Important gotcha: SVG External Scoping
When using an SVG via `<img>`, `background-image`, or `mask-image`, the icon is "sealed." You cannot reach inside the SVG with CSS from your main document to change its paths or colors. 

- **DO** use `currentColor` and `fill="currentColor"` inside your SVGs when they are inlined.
- **DO** use `filter` or `mask-image` with `background-color` if you must keep the file external.
- **DO NOT** expect external SVGs to inherit CSS variables from the parent document until `tmp-linked-parameters` is widely supported.

### Scalability and Layout
- **DO** ensure every SVG has a proper `viewBox` attribute to ensure correct scaling.
- **DO** set explicit `width` and `height` in CSS to prevent layout shifts.

{{ FEATURE_ISSUES("svg") }}
{{ FEATURE_ISSUES("masks") }}

## Fallback strategies

{{ FEATURE_FALLBACKS("svg") }}
{{ FEATURE_FALLBACKS("masks") }}
{{ FEATURE_FALLBACKS("container-style-queries") }}
{{ FEATURE_FALLBACKS("registered-custom-properties") }}
