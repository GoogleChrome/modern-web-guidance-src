---
description: Improve text legibility and aesthetic appeal on the web by implementing responsive typography techniques.
filename: responsive-typography
category: ui
---

# Responsive Typography

Good typography on the web is crucial for presenting text in an appropriate and comfortable way for users, regardless of their device or screen size. This involves considering more than just font choices; it includes text size, line length, and line spacing.

## Best Practices

### Text Sizing

Ensure text is readable across various screen sizes by making it responsive.

*   **Use Media Queries for Breakpoints:** Adjust `font-size` using media queries to scale text appropriately for different viewport widths.
    ```css
    @media (min-width: 30em) {
      html {
        font-size: 125%;
      }
    }
    ```
*   **Employ Fluid Typography with `vw` and `calc()`:** Allow text size to scale smoothly with the viewport width using the `vw` unit combined with `calc()` and relative units like `rem` or `em` to maintain user resizability.
    ```css
    html {
      font-size: calc(0.75rem + 1.5vw);
    }
    ```
*   **Clamp Text Size:** Use the `clamp()` function to set minimum and maximum bounds for font sizes, preventing text from becoming too small on narrow screens or too large on wide screens, while still allowing fluid scaling in between.
    ```css
    html {
      font-size: clamp(1rem, 0.75rem + 1.5vw, 2rem);
    }
    ```

### Line Length

Optimize reading comfort by controlling the width of text lines, drawing inspiration from print typography.

*   **Limit Container Width:** Use `max-inline-size` to restrict how wide text containers can become.
*   **Use Relative Units (`ch`):** Set `max-inline-size` using `ch` units, which represent the width of the '0' character at the current font size, ensuring line lengths adapt to user font size changes. Aim for approximately 45-75 characters per line for optimal readability.
    ```css
    article {
      max-inline-size: 66ch;
    }
    ```

### Line Height

Adjust the spacing between lines of text to improve readability, especially in relation to line length.

*   **Use Unitless Values:** Set `line-height` with unitless values (e.g., `1.5`) so that it scales proportionally with the `font-size` of the text. Shorter lines can accommodate larger `line-height` values.
    ```css
    article {
      max-inline-size: 66ch;
      line-height: 1.65;
    }
    ```

### Web Fonts

Enhance the aesthetic and branding of your content with custom web fonts, while being mindful of performance.

*   **Use WOFF2 Format:** Employ the `woff2` format for web fonts due to its excellent browser support and performance benefits.
    ```css
    @font-face {
      font-family: YourFontName;
      src: url('/fonts/your-font.woff2') format('woff2');
    }
    body {
      font-family: YourFontName, sans-serif;
    }
    ```
*   **Preload Fonts:** Use `<link rel="preload" as="font">` in the `<head>` of your HTML to instruct the browser to download font files early, improving perceived load times.
    ```html
    <link href="/fonts/your-font.woff2" type="font/woff2" rel="preload" as="font" crossorigin>
    ```
*   **Manage Font Loading with `font-display`:** Control how the browser handles the switch between system fonts and web fonts using the `font-display` property (`swap` or `fallback`) to balance immediate readability and visual consistency.
    ```css
    body {
      font-family: YourFontName, sans-serif;
      font-display: swap; /* or fallback */
    }
    ```

### Variable Fonts

Leverage variable fonts to reduce the number of font files needed for different weights and styles, improving performance.

*   **Consolidate Font Files:** Use a single variable font file that contains a range of weights and styles instead of multiple individual font files.
*   **Consider `system-ui`:** Explore using `font-face: system-ui;` which may provide access to variable fonts without requiring downloads.

## Fallback Strategies

While modern CSS features offer powerful typographic controls, ensure graceful degradation for older browsers.

### `font-display` Property

*   **DO** use `font-display: swap;` to show text immediately with a system font and then swap to the web font once it's loaded, providing content quickly.
*   **DO** use `font-display: fallback;` to prioritize the system font if the web font doesn't load within a short period, preventing content shifts.

### CSS Units and Functions

*   Ensure that fluid typography techniques using `vw`, `calc()`, and `clamp()` are paired with relative units (like `rem` or `em`) to maintain text resizability for users who adjust their browser's default font size.
*   When setting `max-inline-size`, prefer relative units like `ch` over fixed units like `px` to ensure lines reflow correctly with changes in font size.