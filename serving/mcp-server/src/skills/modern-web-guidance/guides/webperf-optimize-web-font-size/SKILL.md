---
description: Optimize web font file sizes to ensure good typography doesn't lead to slow websites.
filename: optimize-web-font-size
category: webperf
---

# Optimize Web Font Size

## Best Practices

To reduce the delivered file size of your web fonts, follow these best practices:

*   **Audit and monitor your font usage:** Minimize the number of fonts and variants used on your pages for consistency and speed.
*   **Avoid legacy formats:** Prefer WOFF 2.0 for modern browsers, as EOT and TTF are unnecessary, and WOFF is only needed for older browsers like Internet Explorer 11.
*   **Subset font resources:** Split fonts into smaller Unicode-range subsets (e.g., Latin, Cyrillic) to deliver only necessary glyphs. Optimize for font re-use by subsetting based on script.
*   **Prioritize `local()` in `src`:** List `local('Font Name')` first in your `src` list to avoid unnecessary HTTP requests for locally installed fonts.
*   **Use compression:** Leverage WOFF 2.0's built-in Brotli compression for up to 30% better compression than WOFF.
*   **Consider variable fonts:** For multiple font variants (e.g., regular, bold, italic), a single variable font file can be smaller than multiple individual font files.
*   **Define fonts with `@font-face`:** Use the `@font-face` CSS at-rule to specify font resources, their characteristics, and Unicode codepoints.
*   **Optimize `@font-face` declarations:**
    *   Use `local()` to leverage locally installed fonts.
    *   Provide `url()` entries for external fonts, with `format()` hints.
    *   Order `url()` entries with newer formats (e.g., `woff2`) before older ones (`woff`) to ensure modern browsers use the most efficient format.
    *   Use `unicode-range` to subset fonts for specific character sets, reducing download size. This is especially crucial for Asian languages.
*   **Minimize font variants:** Define only the necessary stylistic variants (e.g., normal and bold) to avoid synthesizing fonts, which can lead to inconsistent rendering.
*   **Preload critical fonts:** Use `<link rel="preload">` to give the browser a head start on requesting essential fonts, especially if they are critical for branding or core content.
*   **Manage `font-display`:** Use `font-display: optional` or `font-display: fallback` to avoid invisible text while fonts are loading and to mitigate layout shifts.

## Effects on Core Web Vitals

*   **Largest Contentful Paint (LCP):** Optimizing web font size directly impacts LCP by allowing text content to be displayed sooner.
*   **Cumulative Layout Shift (CLS):** Careful use of `font-display` properties, such as `optional` or `fallback`, can help prevent layout shifts caused by font loading.

## Tools and Resources

*   **Lighthouse:** Use Lighthouse to test for text compression and other performance-related issues.
*   **pyftsubset:** An open-source tool for subsetting and optimizing fonts.
*   **Google Fonts:** Many font services automatically subset fonts by default or allow manual subsetting via custom parameters.