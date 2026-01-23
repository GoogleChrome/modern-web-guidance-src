---
description: Adaptively render favicons with SVG, leveraging CSS media queries for dynamic styling based on user preferences like light and dark mode.
filename: adaptive-svg-favicon
category: ui
---

# Adaptive SVG Favicon

This guide covers creating an adaptive favicon using SVG, allowing for dynamic styling based on user preferences such as light and dark mode.

## Best Practices

*   **Use SVG for scalability:** SVG provides a vector-based format, ensuring the favicon scales infinitely without losing quality.
*   **Inline styles for media queries:** Embed CSS directly within the SVG to utilize media queries, such as `prefers-color-scheme`, to dynamically change the favicon's appearance.
*   **Consider accessibility:** Ensure the favicon is still recognizable and meaningful in both light and dark modes.

```html
<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    @media (prefers-color-scheme: light) {
      .favicon-icon {
        fill: #000000; /* Dark color for light mode */
      }
    }
    @media (prefers-color-scheme: dark) {
      .favicon-icon {
        fill: #FFFFFF; /* Light color for dark mode */
      }
    }
  </style>
  <path class="favicon-icon" d="M16 2C8.27 2 2 8.27 2 16s6.27 14 14 14 14-6.27 14-14S23.73 2 16 2zm0 20c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
</svg>
```

*   **Provide a fallback:** For browsers that do not support SVG favicons or inline styles within them, ensure a traditional favicon (`.ico`) is also provided.

## Resources

*   **Article:** [Thinking on ways to solve SVG FAVICON](https://goo.gle/3uASh1s)
*   **Demo:** [Try a demo](https://goo.gle/3GAzzt4)
*   **Source Code:** [Get the source](https://goo.gle/3ov8x08)