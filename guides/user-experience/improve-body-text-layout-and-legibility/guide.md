---
name: improve-body-text-layout-and-legibility
description: Improve the layout and legibility of long text content by enabling the browser to manage line breaks to reduce line rag, orphaned text, and other visual artifacts.
web-feature-ids:
  - text-wrap
  - text-wrap-pretty
sources:
  - https://developer.chrome.com/blog/css-text-wrap-pretty/
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-wrap
  - https://12daysofweb.dev/2024/css-text-wrap/
  - https://web.dev/learn/css/typography
  - https://webkit.org/blog/16547/better-typography-with-text-wrap-pretty/
  - https://johnkavanagh.co.uk/articles/the-power-of-text-wrap-pretty/
---

# Improve Body Text Layout and Legibility

The `text-wrap: pretty` CSS property allows you to improve the typographic quality of body text by enabling a more sophisticated wrapping algorithm. It is specifically designed to prevent "orphans" (single words on the last line of a paragraph) and create a more pleasing visual "rag" for long blocks of text.

## Implementation steps

1.  **Identify long-form text elements**: Select elements potentially containing long runs of text where orphaned words (runts) or poor line breaks are most noticeable. This includes the following elements:
  - `<p>`
  - `<blockquote>`
  - `<li>`
  - Any other element potentially containing long runs of text.
2.  **Apply pretty wrapping**: Use `text-wrap: pretty` to enable an optimized algorithm that evaluates the last few lines of a paragraph to find the best break points.

## Example: Optimizing Body Copy

```css
/* Apply to paragraphs to prevent orphaned words */
p {
  /* MANDATORY: Enable pretty line-breaking logic */
  text-wrap: pretty; /* Prioritizes typographic beauty for body copy */
}

/* Also effective for other multi-line text elements */
blockquote, li, .pretty-text {
   /* MANDATORY: Enable pretty line-breaking logic */
  text-wrap: pretty;
}
```

## Key constraints

*   **Performance vs. Quality**: MANDATORY: `text-wrap: pretty` is more computationally expensive than the default `wrap` (greedy) algorithm because it evaluates multiple lines (typically the last four) to optimize the break points. Avoid applying it globally to every element if your page has an extreme amount of text content.
*   **Best for multi-line text**: The benefits of `pretty` are most apparent in paragraphs of three or more lines. It has little to no effect on short, single-line text.
*   **Browser-specific behavior**: Be aware that implementation details vary. Chromium-based browsers typically focus on the last four lines, while other engines may evaluate the entire paragraph.

## Fallback strategies

{{ BASELINE_STATUS("text-wrap-pretty") }}

`text-wrap: pretty` is a progressive enhancement. Browsers that do not support the property will simply ignore it and fall back to the default wrapping behavior. This ensures that your content remains perfectly readable across all browsers while providing a superior experience to those that support it.

```css
/* No @supports block is needed for progressive enhancement */
p {
  text-wrap: pretty; /* Supported browsers will prevent orphans; others will ignore this line */
}
```
