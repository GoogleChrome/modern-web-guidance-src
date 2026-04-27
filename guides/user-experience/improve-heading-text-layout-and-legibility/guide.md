---
name: improve-heading-text-layout-and-legibility
description: Improve the layout and legibility of short standalone text content, such as headings no longer than a few lines, by enabling the browser to apply evenly balanced line breaks when wrapping text.
web-feature-ids:
  - text-wrap
  - text-wrap-balance
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap
  - https://developer.chrome.com/blog/css-text-wrap-balance/
  - https://blog.stephaniestimac.com/posts/2023/10/css-text-wrap/
---

To improve the legibility and aesthetic appeal of short text blocks like headings, use `text-wrap: balance`. This property instructs the browser to distribute text as evenly as possible across lines, creating a more symmetrical appearance and preventing "widows" (a single word on the last line).

### Implementation

Apply `text-wrap: balance` specifically to short, multi-line elements such as headings (`h1`-`h6`), subheadings, or blockquotes.

```css
/* Target specific heading elements for balanced wrapping */
h1, h2, h3, .balanced-heading {
  /* MANDATORY: Enables balanced line-breaking logic */
  text-wrap: balance;
}
```

### Critical Constraints and Performance

*   **Line Limit:** Browsers impose a limit on the number of lines they will attempt to balance to maintain performance (typically **6 lines** in Chromium and **10 lines** in Firefox). If the text exceeds this limit, the browser reverts to standard `wrap` behavior.
*   **Targeted Application:** DO NOT apply `text-wrap: balance` globally (e.g., `* { text-wrap: balance; }`). The iterative "binary search" algorithm used by browsers is computationally expensive. Limit its use to specific, short text elements.
*   **Interaction with Width:** `text-wrap: balance` does not change the container's width (`inline-size`). It only affects how text wraps *within* that width. This can leave empty space at the end of the container, which may affect layouts relying on full-width text blocks.

### Fallback strategies

{{ BASELINE_STATUS("text-wrap-balance") }}

In browsers that do not support `text-wrap: balance`, the property is ignored, and the text will wrap using the default `wrap` behavior. This is a progressive enhancement that gracefully degrades to standard typography.

For critical layouts where manual control is required as a fallback, you can use traditional techniques like `<wbr>` (word break opportunity) or `&nbsp;` (non-breaking space) to influence line breaks, though these are less flexible than the native CSS property.
