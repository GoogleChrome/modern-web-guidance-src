---
name: accessible-generated-content
description: Use CSS generated content (`::before`/`::after`) in ways that stay accessible, including alternative text for decorative content.
web-feature-ids:
  - content
  - alt-text-generated-content
---

# Accessible generated content

- **DON'T** use `content` to convey meaningful text (labels, state, instructions) — keep that in the DOM (WCAG F87). The alt text argument is harm reduction for cases where decoration accidentally carries meaning, not a license.
- Use the alternative text argument of `content` to provide alt text for screen readers. E.g. `content: url(cloud.svg) / "Save";`
- Use `content: "text" / "";` to prevent purely decorative text from being announced to screen readers.
- **DON'T** use an empty alt text argument for images — they're already presentational by default. E.g. this is wrong: `content: url(cloud.svg) / "";`.
- **DON'T** use the alt text argument to describe emojis unless the description differs from the official emoji name. E.g. don't do `content: "🎉" / "celebration";`, but `content: "🎉" / "Yay!";` is fine.

**ONLY** use the alt text argument when the text is different than the primary value and is not already present in the DOM. I.e. this is wrong:

HTML:
```html
<button class="save">Save</button>
```

CSS:
```css
button.save::before {
  content: url(cloud.svg) / "Save";
}
```

A screen reader would read it out as "Save save".

## Fallback strategies

{{ BASELINE_STATUS("alt-text-generated-content") }}

If your Baseline target includes browsers that do not support the `/` alternative text syntax in `content`, those browsers treat the entire `content: ... / ...` declaration as invalid CSS and drop it at parse time—causing the `::before` or `::after` pseudo-element not to render at all.

- **Decorative text or glyphs (`content: "..." / ""`):** Precede the `/` declaration with a single-value `content` declaration as a cascade fallback. Supporting browsers override the fallback and silence the decorative glyph for screen readers; older browsers ignore the second declaration and still render the glyph visually (with the tradeoff that screen readers in those older browsers will announce it).
- **Non-empty alternative text (`content: url(...) / "..."` or `content: "🎉" / "Yay!"`):** A single-value `content` fallback keeps the image or glyph visible in older browsers, but drops the custom alternative text there (leaving generated `url(...)` images unannounced and reading emojis by their default Unicode name). If an icon or glyph conveys required meaning and your Baseline target includes unsupported browsers, put the accessible text in the DOM instead (such as a visually hidden `<span>` or `aria-label` on the host element) and use a plain `content: url(...)` declaration without `/` so supporting browsers do not concatenate and announce the label twice.

```css
/* Decorative glyph: cascade fallback keeps the arrow visible in older browsers,
   while supporting browsers override it and silence the glyph in the accessibility tree. */
.more-link::after {
  content: " →";
  content: " →" / "";
}

/* Non-empty alt text on an element that already has its own DOM text:
   older browsers render the emoji with its default Unicode name, while
   supporting browsers override it and announce "Yay!" instead. */
.milestone-heading::before {
  content: "🎉 ";
  content: "🎉 " / "Yay! ";
}
```
