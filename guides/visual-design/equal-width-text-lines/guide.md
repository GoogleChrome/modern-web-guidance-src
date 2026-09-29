---
name: equal-width-text-lines
description: Make every line of a multi-line heading or lockup span the same width, as in poster-style or stacked-headline typography. Unlike justified text, the text itself is sized to the width rather than the spacing stretched
web-feature-ids:
  - text-fit
  - text-wrap-balance
---

# Equal-Width Text Lines

Poster-style lockups where each line is scaled so it spans the container's full width can create visually striking headings.
Using `text-fit`, the browser scales each line during layout, so it stays correct on resize, copy changes, and font load.

For a single line filling its container (e.g. a heading or pull quote), see {{ GUIDE_REF('fit-text-to-container') }} instead.

## Basic implementation

- Use `text-fit: grow per-line-all <percentage>` on the heading itself.
- Use `per-line-all`, not `per-line`. `per-line` skips the last line and any line ending in a forced break, so with one block per line it scales nothing.
- `grow` cannot be combined with `shrink`. Either set the base `font-size` to a maximum or a minimum depending on what would be a better fallback or easier to calculate, and set `text-fit` to `shrink` or `grow` accordingly.
- Always limit growth or shrinkage with the percentage (e.g. `300%`) as a guardrail.
- The container needs a definite inline size. `text-fit` never changes intrinsic size, so it does nothing on `fit-content`/`max-content` widths or content-sized flex/grid items.
- Trim the leading above the first and below the last line: see {{ GUIDE_REF('precise-text-alignment') }}.

Notes/caveats:
- Note that computed `font-size` is unchanged, so `em` spacing does not scale.

## Visual design

- Keep `line-height` small, `1` or under, otherwise gaps between lines of different font-sizes become unwieldy.
- Lockups look best when there is significant variance in font sizes between lines. Avoid creating lockups from text with mostly uniform lines, as it will result in font sizes that are neither the same, nor sufficiently different, violating the design principle of _contrast_. You can ensure this by creating forced short lines by wrapping certain words to emphasize in `<span>`s and giving them `display: block`. This is especially important when combining with `text-wrap: balance`.
- When forcing short lines, pick words that would enhance the message if emphasized.
- **Limitation:** Growing text will also increase in visual weight and its strokes will be perceived as stronger. There is currently no way to counterbalance this e.g. by reducing `font-weight` for larger text, since there is no unit to use in a calculation, since the scaling does not affect font-relative units like `em`.

### Fallback strategies

{{ FEATURE_FALLBACKS("text-fit") }}

{{ FEATURE_FALLBACKS("text-wrap-balance") }}

Fixed lockups (one block per line) have a short, faithful fallback:

```css
@supports not (text-fit: grow) {
  .lockup > span {
    /* Shrink-wrap each line so its width is the text width */
    width: fit-content;
    white-space: nowrap;
    /* --text-fit-scale is measured by the script; the cap mirrors the text-fit percentage */
    font-size: min(var(--text-fit-scale, 1) * 1em, 300%);
  }
}
```

```js
if (!CSS.supports('text-fit', 'grow per-line-all')) {
  const fit = lockup => {
    const lines = [...lockup.querySelectorAll(':scope > span')];
    // Unscale first: on a refit, offsetWidth would otherwise include the previous scale
    for (const line of lines) line.style.removeProperty('--text-fit-scale');
    // MANDATORY: all reads, then all writes. Interleaving them (e.g. reading
    // lockup.clientWidth inside the write loop) forces one reflow per line.
    const scales = lines.map(line => lockup.clientWidth / line.offsetWidth);
    lines.forEach((line, i) => line.style.setProperty('--text-fit-scale', scales[i]));
  };
  // Refit on resize and font load
  for (const lockup of document.querySelectorAll('.lockup')) {
    new ResizeObserver(() => fit(lockup)).observe(lockup);
  }
}
```

Dynamic copy has no faithful fallback (line breaks are unknown until layout): progressive enhancement to a balanced heading with a fluid base size such as `clamp(2rem, 1rem + 5cqi, 5rem)`.
{# Perhaps there is some kind of polyfill to recommend for cases this effect is critical? #}

