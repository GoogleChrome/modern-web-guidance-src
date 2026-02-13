---
description: Create dynamic, accessible color systems using modern color syntax and relative colors
web-feature-ids:
  - color
  - color-function
  - relative-color
  - rgb
  - oklab
  - light-dark
---

# Modern Color Systems

Reference docs:
- https://piccalil.li/blog/a-pragmatic-guide-to-modern-css-colours-part-one/
- https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_colors/Relative_colors
- https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch

## Best Practices

Use **space-separated syntax** for all color functions. This ensures portability with newer features like Relative Color Syntax (RCS). Favor **OKLCH** for UI components to ensure perceptual uniformity (consistent contrast across different hues).

```css
:root {
  /* 1. Define base brand color */
  --brand: #3b82f6;

  /* 2. Use light-dark() for effortless theming */
  color-scheme: light dark;
  --surface: light-dark(#ffffff, oklch(from var(--brand) 0.1 0.05 h));
}

.button {
  /* 3. Use Relative Color Syntax for state variants */
  background: var(--brand);
  color: white;
}

.button:hover {
  /* Adjust lightness (l) dynamically without defining a new hex */
  background: oklch(from var(--brand) calc(l + 0.1) c h);
}

.button-ghost {
  /* Use the forward-slash for alpha transparency */
  background: oklch(from var(--brand) l c h / 0.15);
}

```

**DO NOT** use legacy comma-separated syntax (e.g., `rgba(255, 0, 0, 0.5)`).
**DO NOT** trust AI-generated CSS defaults for colors; LLMs frequently output legacy syntax that is incompatible with the `from` keyword used in Relative Colors.

## Fallback strategies

If the user's browser does not support Color Level 4 or 5 features, the following fallback strategies MUST be used.

### Space-separated Syntax & Alpha

Baseline since 2020-01-15

* **DO** use space-separated `rgb(r g b / a)` as your default.
* **DO NOT** worry about a polyfill for this unless supporting IE11.

### Relative Color Syntax (RCS)

Baseline since 2024-09-16

* **DO** use `@supports (color: oklch(from red l c h))` for feature detection.
* **DO** provide a "flat" fallback color before the dynamic one for progressive enhancement.
* **DO** use a PostCSS plugin like `postcss-relative-color-syntax` if you require absolute support in older browsers.

```css
.card {
  /* Fallback for older browsers */
  background-color: #3b82f6; 
  /* Modern dynamic version */
  background-color: oklch(from #3b82f6 l c h / 0.1);
}
```

### light-dark() function

Baseline since 2024-05-13

* **DO** use `@supports (color: light-dark(red, blue))` for feature detection.
* **DO** fallback to standard `prefers-color-scheme` media queries.

```css
:root {
  --bg: #ffffff;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1a1a1a;
  }
}

@supports (background: light-dark(#fff, #000)) {
  :root {
    --bg: light-dark(#ffffff, #1a1a1a);
  }
}

```
