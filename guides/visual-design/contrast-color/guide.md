---
name: contrast-color
description: Select a readable text color with sufficient contrast on a dynamic background color.
web-feature-ids:
  - contrast-color
---

# Ensure text readability with dynamic background colors

When building reusable UI components (like badges or buttons) or supporting dynamic themes, ensuring text is readable against an unpredictable background color can be challenging. The `contrast-color()` CSS function resolves to `black` or `white`, maximizing the contrast ratio against the specified background color.

## Determine optimal text color

When an element has a variable or dynamically injected background color, you can rely on the browser to compute the safest text color.

MANDATORY: Set the `color` property using the `contrast-color()` function, passing the background color (or its custom property) as the argument.

```css
.badge {
  /* Define the background color as a custom property */
  --badge-bg: #e02424;
  background-color: var(--badge-bg);
  /* MANDATORY: Dynamic contrasting color */
  color: contrast-color(var(--badge-bg));
}
```

DO NOT: Use `contrast-color()` for `background-color`. It is specifically designed for foreground colors (like text or borders) to contrast against a given background color.

## Integrate with theming

Because `contrast-color()` accepts any valid `<color>` value, including CSS custom properties, it is especially powerful within design systems. By centralizing your background themes as variables, you ensure that foreground content automatically updates its contrast whenever the theme shifts, even to user-specified colors.

DO: Reference shared background variables inside `contrast-color()` to guarantee synchronization across your application.

```css
.theme-card {
  background-color: var(--theme-surface-color);
  color: contrast-color(var(--theme-surface-color));
}

.theme-container[data-theme="light"] {
  --theme-surface-color: #f4f4f4;
}
.theme-container[data-theme="dark"] {
  --theme-surface-color: #1a1a1a;
}
.theme-container[data-theme="custom"] {
  --theme-surface-color: var(--user-custom-theme);
}
```

DO NOT: Hard-code a separate text color for each interaction state when the background is dynamic. Doing so reintroduces the very mismatch `contrast-color()` exists to prevent.

## Fallback strategies

{{ FEATURE_FALLBACKS("contrast-color") }}

To support browsers without `contrast-color()`, you must provide a fallback. If the background color is known and fixed, use a hard-coded contrasting color. For dynamic backgrounds where the color is unknown, choose a strategy from the table below based on your UI requirements and browser support targets.

| Strategy | Best For... | Considerations |
| :--- | :--- | :--- |
| **Relative Color Syntax** | Automated, high-quality CSS-only contrast calculation. | Highest quality CSS-only fallback. |
| **Text Shadow** | Quick readability boost on any background. | Can look "dirty" or "glowy"; may not fit all designs. |
| **Text Stroke** | Preserving font weight while ensuring edge contrast. | Use `paint-order` to avoid thinning letterforms, if available. |
| **Translucent Overlay** | Ensuring a minimum contrast area behind the text. | Changes the look of the background color under the text, requires a separate text element. |
| **SVG Filters** | Reactive contrast that updates as the background changes. | Requires a separate text element; hacky implementation. |

### Recommended: Relative Color Syntax (RCS)

For browsers that support it, RCS provides the most robust automated fallback for dynamic colors.

{{ BASELINE_STATUS("relative-color") }}

```css
@supports (color: oklch(from red l c h)) {
  .badge {
    /* Highest threshold that passes WCAG. Higher values may be more legible. */
    --threshold: 0.623;
    --l: max(0, sign(var(--threshold) - l));
    color: oklch(from var(--badge-bg) var(--l) 0 h);
  }
}

@supports (color: contrast-color(red)) {
  .badge {
    color: contrast-color(var(--badge-bg));
  }
}
```

### Alternative CSS Fallbacks

DO: Select the fallback that best matches your design constraints if RCS is not sufficient or supported.

#### Option 1: Text Stroke

{{ BASELINE_STATUS("text-stroke-fill") }}

```css
.badge--stroke {
  -webkit-text-stroke: 4px black;
}
```
  
#### Option 2: Text Stroke with `paint-order` to preserve letterforms

{{ BASELINE_STATUS("paint-order") }}

```css
.badge--stroke {
  -webkit-text-stroke: 4px black;
  paint-order: stroke fill;
}
```

#### Option 3: Translucent background overlay

```css
.badge--overlay {
  position: relative;
  color: #fff;
  overflow: hidden;
}
.badge--overlay::before {
  content: "";
  position: absolute;
  inset: 0;
  background-color: rgb(0 0 0 / 0.4);
  z-index: 0;
}
.badge--overlay span {
  position: relative;
  z-index: 1;
}
```

#### Option 4: Text Shadow

```css
.badge--shadow {
  text-shadow: 0 1px 3px rgb(0 0 0 / 0.8);
}
```

#### Option 5: SVG Filters

{{ BASELINE_STATUS("svg-filters") }}

1. Load this SVG filter definition. It must be added directly to the HTML document if you need to support Safari, as a [WebKit bug](https://bugs.webkit.org/show_bug.cgi?id=320118) prevents external and data url references for filters. Otherwise, it should be loaded from an external file, either an SVG file or inlined in CSS.

```html
<!-- Technique from https://miunau.com/posts/dynamic-text-contrast-in-css/ -->
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" height="0" style="display: none;">
  <defs>
    <filter id="contrast-filter" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix"
        values="0.2126 0.7152 0.0722 0 0
          0.2126 0.7152 0.0722 0 0
          0.2126 0.7152 0.0722 0 0
          0 0 0 1 0"/>
      <feMorphology operator="dilate" radius="2"/>
      <feComponentTransfer>
        <feFuncR type="linear" slope="-255" intercept="128"/>
        <feFuncG type="linear" slope="-255" intercept="128"/>
        <feFuncB type="linear" slope="-255" intercept="128"/>
      </feComponentTransfer>
      <feComposite operator="in" in2="SourceGraphic"/>
    </filter>
  </defs>
</svg>
```

2. Wrap the text in a `<span>`.

```html
<div class="badge--svg">
  <span>Badge content</span>
</div>
```

3. Apply the filter to the `<span>`.

```css
.badge--svg span{
  color: var(--badge-bg);
  filter: url(#contrast-filter);
}
```
