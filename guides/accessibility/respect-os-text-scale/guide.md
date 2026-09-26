---
name: respect-os-text-scale
description: Respect the operating system's text scale preference for a page so font sizes, layout, and rem-based measurements follow the user's accessibility settings.
web-feature-ids:
  - meta-text-scale
---

# Respect Operating System Text Scale

## Overview

Users with visual impairments often configure text scaling at the operating system level (such as Dynamic Type on iOS or Font Size scaling on Android/ChromeOS). By default, mobile browsers ignore these OS-level accessibility settings to prevent legacy, fixed-pixel websites from breaking visually.

Instead of keeping your page static or relying on custom, fragile JavaScript layout calculations, opt into native operating system text scaling using the `<meta name="text-scale">` tag. When active, the browser dynamically scales the root font size (`1rem`) to match the user's OS preference, allowing all relative (`rem`/`em`) font sizes, layouts, and spacing to scale automatically and gracefully.

## Implementation

### 1. Opt Into OS Text Scaling

Place the `<meta name="text-scale">` element inside your document's `<head>`. This signals to supporting browsers that your layout is modern, adaptive, and safe to scale:

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  
  <!-- Opt this page into OS-level dynamic type and accessibility text scaling -->
  <meta name="text-scale" content="scale" />
  
  <title>Adaptive Accessibility Layout</title>
</head>
```

### 2. Use Relative Typography & Spacing

Always define your font-size, line-height, margin, and padding using relative units (`rem` or `em`) instead of fixed pixels (`px`). This ensures that your entire typography system and spatial layouts expand and contract in proportion to the root font scale:

```css
body {
  font-family: system-ui, sans-serif;
  font-size: 1rem;       /* Automatically scales with the OS setting (e.g. scales up to 24px) */
  line-height: 1.5;      /* Relative to font-size */
  padding: 1.5rem;       /* Scales proportionally to prevent dense crowding at larger scales */
}

h1 {
  font-size: 2.25rem;    /* Scales proportionally to the root base */
  margin-bottom: 1rem;
}
```

### 3. Ensure Content Wrapping & Flexible Heights

When text scales up, elements require more vertical and horizontal space to prevent truncation or overlap. To keep your components robust, design your layouts to expand dynamically around the content rather than forcing rigid coordinates:

* **Avoid Fixed Heights**: Never apply a rigid CSS `height` or `max-height` to text-containing containers (like cards, sidebars, or headers). Use `min-height: auto` or relative boundaries (e.g., `min-height: 10rem`) to let elements grow vertically as text enlarges.
* **Allow Natural Wrapping**: Do not restrict inline-axis text wrapping with `white-space: nowrap` on blocks that contain sentences. Let text reflow to new lines naturally.
* **Employ Flexible Flexbox & Grid wrapping (Optional Example)**: For multi-column card galleries, use reflowing columns like `repeat(auto-fit, minmax(min(100%, 16rem), 1fr))` so items stack vertically if their relative width thresholds are crossed:

```css
/* Card container using min-height to ensure expansion and auto-fit to reflow if needed */
.card {
  padding: 1.5rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  /* Use min-height so the box expands vertically when the font is enlarged */
  min-height: 10rem;
}
```

### 4. DO NOT Override the Root Font Size

When opting in via the `<meta>` tag, **DO NOT** manually multiply or calculate the root font-size in your stylesheet using custom system environment properties:

```css
/* ❌ DO NOT DO THIS: This overrides native behavior and triggers double-scaling */
:root {
  font-size: calc(1rem * env(preferred-text-scale));
}
```

Leave `:root` at its default. The browser handles the scale injection automatically and safely.

---

## Fallback Strategies

On browsers where `<meta name="text-scale" content="scale">` is unsupported, the layout degrades gracefully. The page will display the layout at the browser's standard default base font size (typically 16px), and the user can still utilize standard manual page zoom or pinch-to-zoom options.

{{ FEATURE_FALLBACKS("meta-text-scale") }}
