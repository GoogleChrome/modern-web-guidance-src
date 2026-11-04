---
name: visual-effects
description: Visual effects with CSS such as layered shadows, blend modes, gradients with predictable color interpolation, and patterns like stripes, checkerboards, dots, and pie charts built from gradients alone.
web-feature-ids:
  - box-shadow
  - filter
  - mix-blend-mode
  - background-blend-mode
  - isolation
  - gradients
  - gradient-interpolation
  - conic-gradients
  - color-mix
  - oklab
  - supports
  - custom-properties
  - aspect-ratio
---

# Visual effects

## Depth and texture

- Layer multiple shadows for realistic soft depth effects.
- Use `filter: drop-shadow()` instead of `box-shadow` for non-rectangular shapes or transparent PNGs.
- Use `mix-blend-mode` and `background-blend-mode` for lighting overlays (limit scope with `isolation: isolate`)

```css
.hero {
  background-image: url('texture.png'), linear-gradient(to bottom, #fff, #eee);
  background-blend-mode: soft-light;
}
```

## Gradients and `color-mix()`

Use `in oklch` or `in oklab` to explicitly specify the interpolation color space for gradients or `color-mix()`.

- `in oklch` preserves chroma better, but can more easily get out of device gamut, especially for bigger differences between colors
- `in oklab` stays in gamut more easily (assuming in-gamut endpoints) but can create washed out desaturated colors in the middle, especially when interpolating between opposite hues.
- *DON'T* use `in srgb` unless you have a specific reason to do so (e.g. you are building a color picker that needs to interpolate in srgb).

### Fallback

Some pre-2024 browsers do not support gradient color interpolation space.
To support these browsers, use the token only when its usage is safe by defining a variable:

```css
:root {
  --in-oklab: ;
  --in-oklch: ;
}

@supports (linear-gradient(in oklab, white, black)) {
  :root {
    --in-oklab: in oklab;
    --in-oklch: in oklch;
  }
}
```

Then use like:

```css
.card {
  background: linear-gradient(to bottom var(--in-oklab), var(--accent-color), var(--darker));
}
```

- **Important:** If you use this technique, make sure there is always a non-empty gradient preamble without it, otherwise it will be a syntax error in older browsers.
- You do NOT need this for `color-mix()`. If a browser supports `color-mix()`, it also supports its `in <color-space>` argument.

## Patterns

Many patterns can be created via CSS gradients + hard stops, and these can be more flexible and performant than SVGs or external images as they can have access to CSS variables and lengths from the surrounding context.
You don't need to repeat the position twice — just use `0` or `0%` and gradient fixup will auto-adjust it.

Examples below.

Vertical stripes of `1em` width each:

```css
background: linear-gradient(to right, var(--color-1) 50%, var(--color-2) 0) 0 / 2em;
```

Diagonal stripes of `1em` width each:

```css
background: repeating-linear-gradient(-45deg, var(--color-1) 0 1em, var(--color-2) 0 2em);
```

Checkerboard pattern with `1em` squares:

```css
background: repeating-conic-gradient(var(--color-1) 0 25%, var(--color-2) 0 50%) 0 / 2em 2em;
```

Polka dot with `.5em` radius dots spaced `2em` apart (horizontally/vertically — multiply by `sqrt(2)` for diagonal distance):

```css
--distance: 2em;
--radius: .5em;
--polka: radial-gradient(circle, var(--color-1) var(--radius), transparent calc(var(--radius) + 1px));
background: var(--polka) 0 0, var(--polka) var(--distance) var(--distance) var(--color-2);
background-size: calc(var(--distance) * 2) calc(var(--distance) * 2);
```

Simple pie chart:

```css
.pie {
  --p: 80%;
  width: 60px;
  aspect-ratio: 1;
  border-radius: 50%;
  background: conic-gradient(var(--color-1) var(--p), transparent 0%) var(--color-2);
}
```

## Accessibility considerations

Visual effects are **not** required to meet WCAG 2.2 if they are applied purely for decorative purposes alone.

However, they are subject to certain WCAG success criteria when they convey information or are used to render backgrounds behind text:

For example, when using gradients to render graphs and charts, you MUST:

- Provide a short text description of the chart for screen readers.
- MANDATORY: Provide a semantic data table as an accessible alternative (WCAG 2.2 SC 1.1.1 Non-text Content (Level A)).

For more information, refer to {{ GUIDE_REF("accessibility") }} under the alternate text and media guidelines.

```html
<!-- Complex graph with figcaption and text description -->
<figure>
  <div role="img" aria-label="Sales growth graph 2024" class="graph">...graph generated with visual effects...</div>
  <figcaption>Sales grew 20% in Q3 due to new platform launch.</figcaption>
</figure>

<!-- equivalent semantic data table -->
<table>
  <thead>
    <tr>
      <th scope="col">Period</th>
      <th scope="col">Sales</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">Q1</th>
      <td>$100,000</td>
    </tr>
    <tr>
      <th scope="row">Q2</th>
      <td>$100,000</td>
    </tr>
    <tr>
      <th scope="row">Q3</th>
      <td>$120,000</td>
    </tr>
    <tr>
      <th scope="row">Q4</th>
      <td>$122,000</td>
    </tr>
  </tbody>
</table>
```

When using gradients as backgrounds, make sure that any non-decorative content that overlays the gradient meets minimum contrast requirements for **all** areas of the gradient effect:

- 4.5:1 for normal text and 3:1 for large text (at least 24px, or at least 18.66px bold) (WCAG 2.2 SC 1.4.3 Contrast (Minimum) (Level AA))
- 3:1 for icons (WCAG 2.2 SC 1.4.11 Non-text Contrast (Level AA))

Refer to {{ GUIDE_REF("color") }} for more details.

```css
.myButton {
  /* The contrast between the label color and both colors that make up the gradient exceeds the 4.5:1 threshold */
  color: #111111;
  background: linear-gradient(#ffffff, #aaaaff);
}
```
