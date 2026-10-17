---
name: custom-text-decorations
description: Style and animate text underlines, overlines, and strikethroughs with native text-decoration—including hover-reveal animations, custom offsets and end insets, descender ink skipping, and leading or trailing space skipping—and fall back to SVG lines or gradient and shaped outlines only where text-decoration cannot draw the look.
web-feature-ids:
  - text-decoration
  - text-decoration-skip-ink
  - text-decoration-skip-ink-all
  - tmp-text-decoration-inset
  - text-decoration-skip-spaces
  - background-clip-border-area
  - tmp-path-length
  - border-shape
---

# Custom text decorations

Use the native `text-decoration` properties to style underlines, overlines, and strikethroughs, instead of faking them with borders, background gradients, or pseudo-elements. A native decoration follows the text across wrapped lines, tracks the font's metrics, skips glyph descenders, and inherits through nested elements, so none of that needs to be reimplemented. Reach for the box-based techniques at the end of this guide only when the decoration must outline or wrap the text rather than run along it.

Text decorations apply to any text, not only links. Where underlined text is not a link, make sure it cannot be mistaken for one. When decorating a link, use a real `<a href>` pointing at the destination (add `target="_blank" rel="noopener"` to open a new tab), not `href="javascript:void(0)"` with a script handler. A real link keeps middle-click, copy-link, and screen reader behavior.

## Style the line

Set line, style, color, and thickness with the `text-decoration` shorthand, and the gap from the text with `text-underline-offset`. Expose each value as a custom property so a component or theme can restyle the decoration without touching the rule.

```css
.decorated {
  /* Custom properties let any ancestor restyle the line. The fallbacks are starting points, not rules.
     Thickness is relative to the font size (0.08em is an example value), so the line is not too heavy
     on small text or too light on large text, and max() keeps it at least 1px so it never disappears. */
  text-decoration: underline var(--deco-style, solid) var(--deco-color, currentColor) var(--deco-thickness, max(1px, 0.08em));
  /* Use em so the gap scales with the font size. 0.2em clears most descenders; example value. */
  text-underline-offset: var(--deco-offset, 0.2em);
}

/* Example hover state: a softer line that firms up on hover and focus. The 50% mix and
   0.12em thickness are example values. */
.decorated {
  --deco-color: color-mix(in srgb, currentColor 50%, transparent);
}

.decorated:is(:hover, :focus-visible) {
  --deco-color: currentColor;
  --deco-thickness: max(1px, 0.12em);
}

/* Other lines are a different text-decoration-line on the same properties */
.decorated-over    { text-decoration-line: overline; }
.decorated-through { text-decoration-line: line-through; }
```

`text-decoration-style` accepts `solid`, `double`, `dotted`, `dashed`, and `wavy`. `text-underline-offset` applies to underlines only.

Starting points for the design:

* **Thickness:** about `0.06em` to `0.1em` for body text. Go thicker (`0.1em` to `0.15em`) for headings and emphasized states.
* **Offset:** about `0.15em` to `0.25em`. Dotted and wavy lines need a little more room than solid ones, so raise the offset for them.
* **Color:** `currentColor` keeps the line matched to the text. A softer mix of the text color that firms up on hover keeps long runs of links calm.
* **Style:** `solid` for links, `dotted` for terms and abbreviations, and `wavy` for annotations such as errors.

## Control ink skipping

By default, underlines and overlines break around glyph parts that cross them, such as descenders. Set `text-decoration-skip-ink` to choose the behavior:

```css
.decorated {
  /* auto: skip ink for most scripts (default). none: draw straight through.
     all: also skip ink in scripts where auto does not, such as Japanese or Chinese. */
  text-decoration-skip-ink: all;
}
```

* Keep `auto` for Latin text, and do not declare it: it is the default.
* Use `all` when the underline sits close enough to the baseline to cross ideographic glyphs, or when mixed-script text must look consistent.
* Use `none` for a very thick line, or a deliberately decorative one, where gaps would look like breaks.

Ink skipping applies to underlines and overlines, not strikethroughs.

## Control spaces

`text-decoration-skip-spaces` decides whether the line is drawn under spaces. The default, `start end`, leaves leading and trailing spaces undecorated.

```css
.decorated {
  /* Spaces collapse by default, so there is nothing to skip. Preserve them when the
     leading or trailing spaces are meaningful, such as padded input values. */
  white-space: pre;
  /* none: decorate every space. all: skip every space, so each word is underlined separately.
     start | end | start end: skip only leading, trailing, or both. */
  text-decoration-skip-spaces: all;
}
```

Do not declare `text-decoration-skip-spaces` unless the decoration should visibly cover padding (`none`) or break between every word (`all`). Ordinary inline text, such as the text of a link, has no leading or trailing spaces, so the declaration does nothing.

## Trim or extend the line with an inset

`text-decoration-inset` moves the start and end of the line. A positive value pulls an end inward, a negative value pushes it outward. One value moves both ends; two values set start and end separately. Percentages refer to the inline size of the decorated box.

```css
/* Small insets soften the ends of the line; larger ones read as a deliberately short line.
   Both values are examples. */
.trimmed  { text-decoration-inset: var(--deco-inset, 0.1em); }
.extended { text-decoration-inset: calc(var(--deco-inset, 0.1em) * -1); }
```

To reveal an underline on hover without a border or background gradient, trim the end by 100% and transition it back to 0:

```css
.reveal {
  text-decoration: underline;
  /* Trim the end by the full inline size so the line starts with zero length. */
  text-decoration-inset: 0 100%;
  /* 150ms to 300ms feels responsive without lagging; ease-out starts quickly. Example values. */
  transition: text-decoration-inset var(--reveal-duration, 0.25s) ease-out;
}

/* Include :focus-visible so keyboard users get the same reveal as pointer users. */
.reveal:is(:hover, :focus-visible) {
  text-decoration-inset: 0 0;
}

@media (prefers-reduced-motion: reduce) {
  .reveal {
    transition: none;
    text-decoration-inset: 0 0; /* Keep the underline visible without animation */
  }
}
```

## Draw a custom line with SVG and path-length

Use an SVG path when the line must be a shape `text-decoration` cannot draw, such as a hand-drawn squiggle, and animate it by dashing its stroke. `path-length` sets the path's length to a fixed number, so one dash value works for any shape and size.

```html
<a class="draw" href="#">
  Hover to draw underline
  <svg viewBox="0 0 200 10" aria-hidden="true" focusable="false">
    <path pathLength="100" d="M2 5 C 14 -1, 26 11, 38 5 S 62 -1, 74 5 S 98 11, 110 5 S 134 -1, 146 5 S 170 11, 182 5 S 194 3, 198 5" />
  </svg>
</a>
```

```css
.draw {
  position: relative;
  display: inline-block;
  color: inherit;
  text-decoration: none;
  padding-block-end: 0.3em; /* Space for the SVG line below the text; example value */
}

.draw svg {
  position: absolute;
  inset: auto 0 -0.4em 0; /* Position under the baseline; example value */
  inline-size: 100%;
  block-size: auto;
  overflow: visible;
  pointer-events: none;
}

.draw path {
  fill: none;
  stroke: var(--deco-color, currentColor);
  stroke-width: var(--deco-thickness, max(1px, 0.08em));
  /* Normalize the path to 100 units. Every dash value below is then a percentage of the
     path, whatever its real length. */
  path-length: 100;
  stroke-dasharray: 100;
  stroke-dashoffset: 100; /* Fully hidden */
  /* A slightly slower draw than a hover reveal reads as drawing; example duration. */
  transition: stroke-dashoffset var(--draw-duration, 0.6s) ease-out;
}

.draw:is(:hover, :focus-visible) path {
  stroke-dashoffset: 0; /* Fully drawn */
}

@media (prefers-reduced-motion: reduce) {
  .draw path { transition: none; stroke-dashoffset: 0; }
}
```

Position the `<svg>` under the text, mark it `aria-hidden="true"`, and keep its `viewBox` aspect ratio instead of stretching it with `preserveAspectRatio="none"`.

DO NOT use `vector-effect: non-scaling-stroke` on the path. It measures dashes in screen pixels, which defeats the normalization and leaves the line partly drawn.

## Outline text with a box instead

Two box properties decorate text by outlining it rather than running a line along it. Use them on an inline-block, and give the text padding so the outline does not touch it.

```css
/* Gradient outline with a see-through middle */
.ring {
  display: inline-block;
  padding: 0.2em 0.75em; /* Example values: enough room that the outline does not touch the text */
  /* The border width is the visible outline thickness. Relative to the font size, with a 2px
     minimum so it stays visible on small text; example value. */
  border: var(--ring-width, max(2px, 0.12em)) solid transparent;
  background: linear-gradient(135deg, var(--ring-start, #2563eb), var(--ring-end, #db2777)) border-box;
  /* Paint the background only under the border, so the inside stays transparent. */
  background-clip: border-area;
}

/* Border that follows a shape, such as a circled word */
.circled {
  display: inline-block;
  padding: 0.2em 1.1em; /* Example values: wide enough that the ellipse does not clip the text */
  border: var(--shape-stroke, max(2px, 0.08em)) solid var(--shape-color, currentColor); /* Example stroke width */
  /* A single shape strokes along its path. Two shapes fill the area between them.
     ellipse(50% 50%) is an example; use circle(), polygon(), or shape() for other outlines. */
  border-shape: ellipse(50% 50%);
}
```

`border-shape` replaces only the border. The background is still the rectangular box, so do not rely on it to fill a shape.

## Choose a technique

* **`text-decoration`** (line, ink skipping, spaces, inset): the line should run along the text, wrap with it, and follow its font metrics. This is the default choice.
* **SVG with `path-length`**: the line is a custom shape or needs a draw-on animation. Choose it only when `text-decoration-style` cannot produce the look, because it needs extra markup and positioning. For broader vector path animations, see {{ GUIDE_REF("line-drawing-animation") }}.
* **`background-clip: border-area`**: the text needs a gradient outline. Use plain `border-color` when a solid outline is enough. For complete gradient border styling, see {{ GUIDE_REF("gradient-borders") }}.
* **`border-shape`**: the outline needs a non-rectangular shape, such as a circle or tag. Use `border-radius` when rounded corners are enough. For shaped element styling, see {{ GUIDE_REF("element-shape") }}.
* **Inset hover reveal**: worth adding when a link needs a hover affordance beyond a color change. Skip it for text that is not interactive.

## Fallback Strategies

Each fallback keeps the text readable and keeps the core decoration. Frame the need in terms of your Baseline target: if it includes browsers without a property, apply the matching fallback.

### Ink skipping `all`

{{ BASELINE_STATUS("text-decoration-skip-ink-all") }}

If your Baseline target does not support `text-decoration-skip-ink: all`, the declaration is ignored and the browser keeps `auto`. Latin descenders are still skipped; only scripts that `auto` does not cover, such as Japanese, lose ink skipping. This is graceful degradation, so no extra code is needed.

### Skip spaces

{# {{ BASELINE_STATUS("text-decoration-skip-spaces") }} #}

If your Baseline target does not support `text-decoration-skip-spaces`, the browser uses its own default handling of spaces. This is graceful degradation: the line is drawn under spaces the browser does not skip.

### Inset

{# {{ BASELINE_STATUS("tmp-text-decoration-inset") }} #}

If your Baseline target does not support `text-decoration-inset`, wrap every inset rule in `@supports` so unsupported browsers keep a normal, fully visible underline instead of an invisible one. This is progressive enhancement: the hover reveal is lost and the link stays underlined.

```css
.reveal {
  text-decoration: underline; /* Always visible without inset support */
}

@supports (text-decoration-inset: 0) {
  .reveal {
    text-decoration-inset: 0 100%; /* Only hide the line where it can be revealed again */
    transition: text-decoration-inset var(--reveal-duration, 0.25s) ease-out; /* Example duration */
  }

  .reveal:is(:hover, :focus-visible) {
    text-decoration-inset: 0 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .reveal {
      transition: none;
      text-decoration-inset: 0 0;
    }
  }
}
```

### Path length

{# {{ BASELINE_STATUS("tmp-path-length") }} #}

If your Baseline target does not support the `path-length` CSS property, set the `pathLength` attribute on the SVG `<path>` to the same value. It normalizes `stroke-dasharray` and `stroke-dashoffset` identically in every browser, so the animation is unchanged. Keep the attribute and the CSS value in sync.

```html
<!-- Same value as path-length: 100 in the stylesheet -->
<path pathLength="100" d="M2 5 C 14 -1, 26 11, 38 5 S 62 -1, 74 5"></path>
```

### Border area

{{ BASELINE_STATUS("background-clip-border-area") }}

If your Baseline target does not support `background-clip: border-area`, the declaration is ignored and the background paints under the whole border box, filling the text instead of only its outline. Use a solid border color outside the feature, and apply `background-clip: border-area` and its gradient only inside `@supports`. This is progressive enhancement: unsupported browsers show a solid outline.

```css
.ring {
  border: var(--ring-width, max(2px, 0.12em)) solid var(--ring-start, #2563eb); /* Solid fallback; example width */
}

@supports (background-clip: border-area) {
  .ring {
    border-color: transparent; /* Reveal the gradient painted under the border */
    background: linear-gradient(135deg, var(--ring-start, #2563eb), var(--ring-end, #db2777)) border-box;
    background-clip: border-area;
  }
}
```

### Border shape

{{ BASELINE_STATUS("border-shape") }}

If your Baseline target does not support `border-shape`, the declaration is ignored and the element keeps its normal rectangular border. Keep a pill-shaped border outside the feature, and apply `border-shape`, plus any `border-radius` or padding changes that only make sense with the shape, inside `@supports`. This is progressive enhancement: unsupported browsers show a plain rounded outline.

```css
.circled {
  display: inline-block;
  padding: 0.2em 0.9em; /* Example values */
  border: var(--shape-stroke, max(2px, 0.08em)) solid var(--shape-color, currentColor);
  border-radius: 999px; /* Fallback outline; any value large enough to round the ends works */
}

@supports (border-shape: circle(50%)) {
  .circled {
    border-radius: 0; /* The shape replaces the rounded corners */
    padding-inline: 1.1em; /* Example value: extra room for the ellipse */
    border-shape: ellipse(50% 50%);
  }
}
```
