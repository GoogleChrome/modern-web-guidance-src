---
name: improve-text-layout-and-legibility
description: Improve the layout and legibility of short standalone text content, such as headings no longer than a few lines, by enabling the browser to apply evenly balanced line breaks when wrapping text.
web-feature-ids:
  - text-wrap-balance
  - text-wrap-pretty
---

# Improve Text Layout and Legibility

The layout of text, particularly at the ends of lines and ends of paragraphs, can impact the legibility and aesthetic appeal of a page. CSS provides several text wrapping options that can improve specific use cases.

For short text blocks like headings, use `text-wrap: balance`. This property instructs the browser to distribute text as evenly as possible across lines, creating a more symmetrical appearance.

The `text-wrap: pretty` CSS property allows you to improve the typographic quality of body text by enabling a more sophisticated wrapping algorithm. It is specifically designed to prevent "orphans" (single words on the last line of a paragraph) and create a more pleasing visual "rag" for long blocks of text.

## Implementation

### 1. **Identify text elements**: 

For `text-wrap: balance`, select short text blocks like headings and table headers. Avoid elements that have visible boxes such as borders or backgrounds, as this can create unexpected visually empty areas in the layout.

For `text-wrap: pretty`, select elements potentially containing long runs of text where orphaned words (runts) or poor line breaks are most noticeable. This includes the following elements:
  - `<p>`
  - `<blockquote>`
  - `<li>`
  - Any other element potentially containing long runs of text.

#### Choosing the Right Wrapping Method

| Criteria | `text-wrap: balance` | `text-wrap: pretty` | `text-wrap: wrap` (Default) |
| :--- | :--- | :--- | :--- |
| **Best For** | Short blocks (Headings, Titles) | Long blocks (Paragraphs, Lists) | Performance-critical content |
| **Visual Goal** | Symmetrical line lengths | Avoiding orphans ("runts") | Fast, standard wrapping |
| **Line Constraints** | Browser-specific cap (e.g., up to 6–10 lines) | Best for 3 to many lines | No limit |
| **Perf Cost** | **High**: Line-balancing heuristic (e.g. binary search) | **Medium**: Multi-line heuristic (e.g. look-back) | **Low**: Standard greedy algorithm |

### 2. **Apply the chosen wrapping**: 

Apply `text-wrap: balance` specifically to short, multi-line elements such as headings (`h1`-`h6`), subheadings, or pullquotes.

```css
/* Target specific heading elements for balanced wrapping */
h1, h2, h3, h4, h5, h6 {
  /* Enables balanced line-breaking logic */
  text-wrap: balance;
}
```

Use `text-wrap: pretty` to enable an engine-specific line-breaking algorithm (evaluating the last few lines of a paragraph or the whole block) to find the best break points and prevent orphans.

```css
/* Apply to multi-line text blocks to prevent orphaned words */
p, blockquote, li, .pretty-text {
  /* Enables pretty line-breaking logic for body copy */
  text-wrap: pretty;
}
```

### Critical Constraints and Performance

#### text-wrap: balance

*   **Line Limit:** Browsers impose an engine-specific limit on the number of lines they will attempt to balance to maintain performance (for example, typically **6 lines** in Chromium and **10 lines** in Firefox, though these thresholds are implementation details and subject to change). If the text exceeds this limit, the browser reverts to standard `wrap` behavior. Avoid using `text-wrap: balance` on text blocks that are likely to exceed these limits.
*   **Targeted Application:** DO NOT apply `text-wrap: balance` globally (e.g., `* { text-wrap: balance; }`). The iterative line-balancing algorithm (such as binary search in Chromium) is computationally expensive and its exact heuristic is browser-specific. Limit its use to specific, short text elements.
*   **Interaction with Width:** `text-wrap: balance` does not change the container's width (`inline-size`). It only affects how text wraps *within* that width. This can leave empty space at the end of the container, which may affect layouts relying on full-width text blocks.

#### text-wrap: pretty

*   **Performance vs. Quality**: MANDATORY: `text-wrap: pretty` is more computationally expensive than the default `wrap` (greedy) algorithm because browser engines evaluate multiple lines (such as the last four lines in Chromium) or the full paragraph to optimize break points. Avoid applying it globally to every element if your page has an extreme amount of text content.
*   **Best for multi-line text**: The benefits of `pretty` are most apparent in paragraphs of three or more lines. It has little to no effect on short, single-line text.
*   **Browser-specific behavior**: Be aware that implementation details vary. Chromium-based browsers typically focus on the last four lines, while other engines may evaluate the entire paragraph.

### Fallback strategies

{{ BASELINE_STATUS("text-wrap-balance") }}
{{ BASELINE_STATUS("text-wrap-pretty") }}

In browsers that do not support `text-wrap: balance` or `text-wrap: pretty`, the property is ignored, and the text will wrap using the default `wrap` behavior. This is a progressive enhancement that gracefully degrades to standard typography. This ensures that your content remains perfectly readable across all browsers while providing a superior experience to those that support it.

For critical layouts where refined text layout is a requirement, use a JavaScript library, but be aware that this may be slow and cause performance issues.