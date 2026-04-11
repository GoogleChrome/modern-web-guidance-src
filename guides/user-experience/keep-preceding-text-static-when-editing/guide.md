---
name: keep-preceding-text-static-when-editing
description: Reduce visual noise in editable text by ensuring text before the edit point remain stable and only the new text is re-wrapped.
web-feature-ids:
  - text-wrap
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap
  - https://web.dev/learn/css/typography#control_how_text_wraps
---

When users edit text in a `contenteditable` element, browsers recalculate line breaks for the entire paragraph. This can cause lines above the cursor to re-wrap or the cursor to jump as the user types. Use `text-wrap: stable` to ensure that lines of text preceding the edit point remain static.

### Implementation

Apply `text-wrap: stable` to elements where users interact with text via `contenteditable` elements.

```css
/* Apply to editable elements to prevent preceding lines from re-wrapping during input */
[contenteditable="true"],
textarea {
  /* MANDATORY: Ensures preceding lines remain static */
  text-wrap: stable;
}
```

### Fallback strategies

{{ BASELINE_STATUS("text-wrap") }}

If `text-wrap: stable` is not supported, the browser will fall back to its default wrapping behavior (usually `auto` or `wrap`). While the user will experience the standard "jittery" re-wrapping, the content remains fully functional.

For critical editing interfaces where visual stability is a requirement, you can detect support and apply a simplified layout if necessary, though in most cases, the native fallback is acceptable.

```javascript
if (!CSS.supports('text-wrap', 'stable')) {
  // Optional: Apply additional padding or fixed-width containers 
  // to minimize the impact of re-wrapping if stability is critical.
}
```
