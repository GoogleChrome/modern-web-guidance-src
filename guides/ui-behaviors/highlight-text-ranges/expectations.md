* The `::highlight()` pseudo-element is used in CSS to style at least one named highlight.
* `CSS.highlights.set()` is called to register at least one `Highlight` object in the `HighlightRegistry`.
* `Highlight` objects are constructed from one or more `Range` objects.
* `Range` objects have their start and end set on text nodes (not element nodes).
* `CSS.highlights.clear()` is called before recalculating highlights to prevent stale ranges.
* Only allowable CSS properties are used inside `::highlight()` (e.g., `color`, `background-color`, `text-decoration`, `text-shadow`). Properties like `font-size`, `padding`, or `background-image` are NOT used inside `::highlight()`.
* Text nodes are collected using `TreeWalker` with `NodeFilter.SHOW_TEXT`, rather than manipulating `innerHTML` or wrapping text in extra DOM elements.
* Feature detection checks for `CSS.highlights` before using the API.
* A fallback strategy is implemented for browsers that do not support the API (e.g., wrapping text in `<mark>` elements).
* If the fallback builds matches dynamically, search input is either escaped before use in a `RegExp` or inserted via `textContent` (not `innerHTML`) to avoid injection.
* The highlight visually changes the appearance of matched text (e.g., different background color or text decoration).
* There is a contrast of at least 4.5:1 (or 3:1 for large text greater than 18pt or 14pt bold) between the matched text and the highlight color
* There is a contrast of at least 3:1 between the highlight color and adjacent colors OR non-color styling is also applied to the matched text
* Highlights must not rely on color alone to convey meaning (e.g., highlighted error text must be paired with another visual indicator such as `text-decoration: wavy underline` or an adjacent text label)
