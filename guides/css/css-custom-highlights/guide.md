---
name: css-custom-highlights
description: Highlight arbitrary text ranges on a page without modifying the DOM, using the CSS Custom Highlight API. For example, highlighting search results, spelling errors, or collaborative editing cursors.
web-feature-ids:
  - highlight
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::highlight
---

The CSS Custom Highlight API lets you style arbitrary text ranges on a page without modifying the DOM structure. This enables search-result highlighting, syntax coloring, collaborative editing cursors, or spelling and grammar error markers without wrapping text in extra elements or relying on `innerHTML` manipulation.

### Core implementation

To highlight text ranges, you must collect the target text nodes, create `Range` and `Highlight` objects, register them in the `HighlightRegistry`, and then style them with the `::highlight()` pseudo-element.

#### 1. Collect text nodes and create ranges
Use a `TreeWalker` to collect all text nodes in the target element, then create `Range` objects pointing at the character offsets you want to highlight.

```javascript
const article = document.querySelector("article");

// MANDATORY: Use TreeWalker to collect text nodes — do not manipulate innerHTML.
const treeWalker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
const allTextNodes = [];
let currentNode = treeWalker.nextNode();
while (currentNode) {
  allTextNodes.push(currentNode);
  currentNode = treeWalker.nextNode();
}

// MANDATORY: Set range start/end on text nodes, not element nodes.
const range = new Range();
range.setStart(textNode, matchStartIndex);
range.setEnd(textNode, matchEndIndex);
```

Cache the text-node list and only rebuild it when the DOM content actually changes, since walking the tree is expensive.

#### 2. Create a Highlight from the ranges
Group one or more `Range` objects into a `Highlight`. Multiple ranges that share the same style belong in a single highlight.

```javascript
const searchHighlight = new Highlight(...matchingRanges);
```

#### 3. Register the highlight in the registry
Register each `Highlight` under a custom name using `CSS.highlights`, which is a `Map`-like `HighlightRegistry`.

```javascript
// MANDATORY: Clear previous highlights before registering new ones
// to avoid stale ranges persisting on the page.
CSS.highlights.clear();

CSS.highlights.set("search-results", searchHighlight);
```

When multiple highlights overlap, use the `priority` property to control stacking order. Higher priority highlights paint on top.

```javascript
const primary = new Highlight(...primaryRanges);
primary.priority = 1;

const secondary = new Highlight(...secondaryRanges);
secondary.priority = 0; // painted first (behind primary)

CSS.highlights.set("primary", primary);
CSS.highlights.set("secondary", secondary);
```

#### 4. Style with `::highlight()`
Use the `::highlight()` pseudo-element in CSS to style each registered highlight by name.

```css
::highlight(search-results) {
  background-color: #ffdd00;
  color: black;
}
```

Only a limited set of CSS properties work inside `::highlight()`: `color`, `background-color`, `text-decoration` and its longhands, `text-shadow`, `-webkit-text-stroke-color`, `-webkit-text-fill-color`, and `-webkit-text-stroke-width`. Properties like `background-image`, `font-size`, or `padding` are ignored.

### Accessibility

**AVOID**: using custom highlights as a replacement for semantic HTML.

Custom highlights are purely presentational and are not exposed to the accessibility tree. If the highlighted text is semantically relevant to the document (e.g., a user-selected passage), use `<mark>` instead. Reserve custom highlights for transient, visual-only effects like search results or syntax coloring.

Highlights should not rely solely on color to convey meaning. If a highlight indicates an error, pair it with another visual indicator such as `text-decoration: wavy underline` or an adjacent text label. Ensure sufficient contrast between the highlight background and text color to meet WCAG 2.1 requirements (at least 4.5:1 for normal text).

### Fallback strategies
{{ BASELINE_STATUS("highlight") }}

For browsers that do not support the CSS Custom Highlight API, you should provide a functional base experience where text is still legible, even without the visual highlight.

#### Feature detection
You can detect support before using the API:

```javascript
if (CSS.highlights) {
  // CSS Custom Highlight API is supported.
} else {
  // Fallback: wrap matches in <mark> elements.
}
```

#### DOM-based fallback

If the highlight is critical for the user experience, fall back to wrapping matched text in `<mark>` elements. This modifies the DOM, so take care to preserve event listeners and avoid breaking the document structure.

```javascript
if (!CSS.highlights) {
  // IMPORTANT: Escape user input to prevent XSS when using innerHTML.
  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  article.innerHTML = article.textContent.replace(
    regex,
    "<mark>$1</mark>"
  );
}
```
