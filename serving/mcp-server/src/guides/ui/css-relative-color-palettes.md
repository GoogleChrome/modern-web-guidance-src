---
description: Create dynamic color palettes with CSS relative color syntax for consistent and adaptable theming.
filename: css-relative-color-palettes
category: ui
---

# Creating Dynamic Color Palettes with CSS Relative Color Syntax

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/relative_color_syntax
- https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch

## Best Practices

Leverage CSS relative color syntax, particularly with perceptually uniform color spaces like OKLCH, to generate color palettes programmatically. This approach allows for dynamic color generation based on a base color, enabling adaptable theming and consistent color variations across your design system.

When creating color palettes, consider the following:

*   **Use `oklch()` for predictable results:** The OKLCH color space provides a more intuitive way to adjust lightness, chroma, and hue, leading to more predictable color variations, especially for gradients and monochromatic scales.
*   **Define a base color:** Set a `--base-color` custom property. All other colors in the palette will be derived from this single source.
*   **Derive variations using `calc()`:** Use `calc()` to adjust channels like lightness (`l`) or hue (`h`) relative to the base color. This allows for smooth transitions and consistent adjustments.
*   **Monochromatic palettes:** Create variations by adjusting the lightness channel (`l`). Add or subtract a percentage to achieve lighter or darker shades.
    ```css
    :root {
      --base-color: deeppink;

      --color-0: oklch(from var(--base-color) calc(l + .20) c h); /* lightest */
      --color-1: oklch(from var(--base-color) calc(l + .10) c h);
      --color-2: var(--base-color);
      --color-3: oklch(from var(--base-color) calc(l - .10) c h);
      --color-4: oklch(from var(--base-color) calc(l - .20) c h); /* darkest */
    }
    ```
*   **Analogous palettes:** Achieve analogous colors by rotating the hue (`h`) channel. Add or subtract degrees to find harmonious adjacent colors.
    ```css
    :root {
      --base-color: blue;

      --primary:   var(--base-color);
      --secondary: oklch(from var(--base-color) l c calc(h - 45));
      --tertiary:  oklch(from var(--base-color) l c calc(h + 45));
    }
    ```
*   **Triadic palettes:** Generate triadic colors by rotating the hue (`h`) by 120 degrees in both directions.
    ```css
    :root {
      --base-color: yellow;
      --triad-1: oklch(from var(--base-color) l c calc(h - 120));
      --triad-2: oklch(from var(--base-color) l c calc(h + 120));
    }
    ```
*   **Tetradic palettes:** Create tetradic palettes by rotating the hue (`h`) by 90, 180, and 270 degrees.
    ```css
    :root {
      --base-color: lime;

      --color-1: var(--base-color);
      --color-2: oklch(from var(--base-color) l c calc(h + 90));
      --color-3: oklch(from var(--base-color) l c calc(h + 180));
      --color-4: oklch(from var(--base-color) l c calc(h + 270));
    }
    ```
*   **Monochromatic with hue rotation:** Add a subtle hue rotation to monochromatic scales for more visually interesting and less "flat" palettes. This can create smooth gradients between hues as lightness changes.
    ```css
    :root {
      --base-color: deeppink;

      --color-1: var(--base-color);
      --color-2: oklch(from var(--base-color) calc(l - .10) c calc(h - 10));
      --color-3: oklch(from var(--base-color) calc(l - .20) c calc(h - 20));
      /* ... and so on */
    }
    ```
*   **Use `var()` for dynamic theming:** Combine custom properties with relative color syntax to create themes where changing a single `--base-color` variable updates the entire color palette.

## Fallback strategies

CSS relative color syntax and advanced color spaces like OKLCH are well-supported in modern browsers. However, for broader compatibility or specific fallback needs:

*   **Use `@supports` for feature detection:** Check for support of `color: rgb(from white r g b)` or specific color spaces like `oklch()` to conditionally apply styles.
    ```css
    @supports (color: rgb(from white r g b)) {
      /* Use relative color syntax */
      .my-element {
        background: oklch(from blue calc(l * 1.25) c h);
      }
    }
    ```
*   **Provide fallback colors:** For browsers that do not support relative color syntax, define fallback colors using traditional methods (e.g., hex, RGB, HSL).
    ```css
    .my-element {
      background: blue; /* Fallback */
      background: oklch(from blue calc(l * 1.25) c h); /* Modern */
    }
    ```
*   **Consider color conversion libraries:** If complex color manipulation is required and extensive browser support is paramount, JavaScript color libraries can be used as a fallback or alternative. However, for palette generation, CSS solutions are generally preferred for performance and maintainability.