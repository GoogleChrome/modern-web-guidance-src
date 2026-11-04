---
name: typography
description: Typography best practices for the web, including font sizing units, line height, text wrapping and balancing, and fluid type that scales with the viewport.
web-feature-ids:
  - font-size
  - rem
  - em-unit
  - line-height
  - overflow-wrap
  - text-wrap
  - text-wrap-balance
  - text-wrap-pretty
  - min-max-clamp
  - viewport-units
todo-web-feature-ids:
  - text-fit
  - text-decoration-inset
  - text-decoration-skip-ink-all
---

# Typography

{# Top-level discipline guide for anything typography-related #}

## Overall best practices

- Use unitless numbers for `line-height` (e.g., `1.5`) to ensure relative scaling during font-size inheritance.
- Use `overflow-wrap: break-word` (or `anywhere`) to contain long URLs.
- **DON'T** use `px` for font-size. Prefer `rem` to honor the user's browser font-size preferences (root font size), or `em`/percentages for contextual sizing.

## Readability

- **Avoid long lines of text**: Cap paragraph blocks to a maximum of 80 characters width.
- **Avoid rivers of whitespace**: Avoid `text-align: justify` as it can make text harder to read. If you must use it, combine it with `hyphens: auto` to avoid excessive whitespace between words.
- **Don't use Ornate fonts**: Omit cursive typefaces for main reading content.
- **Don't rely on all-caps for emphasis**: Prefer bolding for visual emphasis, and use `<em>`/`<strong>` when the emphasis is semantic.
- **Limit emphasis overall**: Emphasis loses meaning when it's everywhere — apply it only where it changes how the content should be read.
- **Support user zoom preferences**: Allow users to resize text up to 200% without loss of content or functionality.

```css
body {
  line-height: 1.5;
  text-align: start; /* Supports LTR and RTL */
}
article {
  max-width: 80ch; /* Caps line length to ~80 characters for readability */
}
```

## Text wrapping

- Use `text-wrap: balance` for balanced headlines and headline-like content (e.g. `<th>`)
- Use `text-wrap: pretty` for long-form body text (paragraphs, blockquotes, etc.)
- Use `text-wrap: balance` or `text-wrap: pretty` deliberately, **DO NOT** apply it on `*` as it does have a performance cost.
- Avoid `text-wrap: balance` on elements with a visible box (backgrounds, borders, shadows, etc) as it does not change the container's width, it only affects how text wraps *within* that width. This can leave empty space at the end of the container, which is usually undesirable.

## Responsive Typography

- **DO** combine viewport-relative and font-relative units in `clamp()` for font sizes that scale with the viewport size while ensuring they stay within a desired range. For example, `clamp(2rem, 1rem + 5vw, 4rem)`. Adjust the proportion of viewport-relative and font-relative units to control how quickly the font-size changes.
- **DON'T** use `vw` alone for font-size without `clamp()`, as it can scale text too small or too large on extreme screens.
