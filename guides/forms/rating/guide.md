---
name: rating
description: Build a rating component that allows users to provide feedback on a scale (e.g., 1 to 5 stars), with support for half ratings.
web-feature-ids:
  - meter
  - input-range
  - attr
guides:
  - icons
---

# Star rating

Build a star rating that supports half stars. Pick exactly one variant from the task before writing any markup or CSS:

* **Read-only** (`<meter class="rating">`): displays an existing score.
* **Interactive** (`<input type="range" class="rating">`): collects a user rating, optionally displaying an average score in a distinct fill until edited. This is the default when the task is ambiguous.

Do not build a rating from radio buttons, clickable `<span>`s, or ARIA `slider` roles—the native range input already provides keyboard, pointer, touch, and assistive technology behavior.

## Draw the stars with a mask and a gradient

Define custom properties for `--star-size` (at least `3rem` so each half star is `1.5rem` / `24px`, shrinking via `clamp()` only on very narrow viewports), filled, average, and empty colors for light and dark schemes, and `--icon-star` holding a `url()` to a star icon, such as an SVG file or data URI (see {{ GUIDE_REF("icons") }}). Read `--max` and `--control-value` via typed `attr()` on `.rating`, and repeat `--icon-star` with `repeat-x` as a `mask` over a hard-stop `linear-gradient` driven by `--control-value`. In forced-colors mode, override the star colors with `light-dark(CanvasText, Highlight)` for filled stars and a `color-mix()` of `CanvasText` and `Canvas` for empty stars (so contrast with `Canvas` holds in any scheme) and opt out of color adjustment (see {{ GUIDE_REF("color") }}).

```css
:root {
  --color-star-filled: #fbbf24;
  --color-star-average: light-dark(#6366f1, #a5b4fc);
  --color-star-empty: light-dark(#c9c9d4, #4a4a58);
}

.rating {
  --max: attr(max type(<number>), 5);
  --control-value: attr(value type(<number>), 0);
  --_offset: 0px;
  --_display-value: var(--control-value);
  inline-size: calc(var(--star-size) * var(--max));
  block-size: var(--star-size);
  /* Hard stop at offset + display-value fills partial and half stars */
  --_stars-bg: linear-gradient(to right in oklch,
      var(--color-star-filled) calc(var(--_offset) + var(--_display-value) * var(--star-size)),
      var(--color-star-empty) 0);
  --_stars-mask: var(--icon-star) 0 0 / var(--star-size) var(--star-size) repeat-x;

  @media (forced-colors: active) {
    --color-star-filled: light-dark(CanvasText, Highlight);
    --color-star-average: light-dark(CanvasText, Highlight);
    --color-star-empty: color-mix(in srgb, CanvasText 40%, Canvas);
    forced-color-adjust: none;

    &::-webkit-meter-bar,
    &::-webkit-slider-runnable-track,
    &::-webkit-slider-thumb {
      forced-color-adjust: none;
    }

    &::-moz-meter-bar,
    &::-moz-range-track,
    &::-moz-range-thumb {
      forced-color-adjust: none;
    }
  }
}
```

### Distinct filled and empty star icons

When empty and filled stars use different icons (such as an outlined star and a solid star), define `--icon-star-empty` and `--icon-star-filled` with matching outer silhouettes (e.g., identical `viewBox` and `stroke-width` so half stars align cleanly) and composite three `mask` layers. Keep `attr()`-derived values (`--_fill-stop` in `--_mask-clip` and `--_offset` in `mask-position`) out of the custom properties holding the icon `url()`s (otherwise `attr()` tainting drops the `url()` layers), and apply the composite `mask` directly on `meter.rating` and the range track pseudo-elements:

```css
.rating {
  --_fill-stop: calc(var(--_offset) + var(--_display-value) * var(--star-size));
  --_stars-bg: linear-gradient(to right in oklch,
      var(--color-star-filled) var(--_fill-stop),
      var(--color-star-empty) 0);
  --_mask-empty: var(--icon-star-empty) 0 0 / var(--star-size) var(--star-size) repeat-x;
  --_mask-filled: var(--icon-star-filled) 0 0 / var(--star-size) var(--star-size) repeat-x;
  --_mask-clip: linear-gradient(to right, #000 var(--_fill-stop), transparent 0);
}

/* On meter.rating, &::-webkit-slider-runnable-track, and &::-moz-range-track */
mask: var(--_mask-empty) add, var(--_mask-clip) intersect, var(--_mask-filled);
/* On the range track pseudo-elements, shift the star layers without tainting url() */
mask-position: var(--_offset) 0, 0 0, var(--_offset) 0;
```

**Limitation:** because all stars share repeated `mask` layers on one element, enlarging only the star currently being hovered is awkward and would require an extra mask layer.

To transition or animate the fill, mirror `--control-value` into a component-specific `@property` (`syntax: "<number>"`) rather than registering `--control-value` directly, and disable any transition or press animation under `prefers-reduced-motion: reduce`.

## Read-only rating: a meter

For an average or non-editable score, use `<meter class="rating" min="0" max="5" value="3.5">` with an accessible name via `aria-labelledby` pointing at visible text that includes the score (e.g. `Average rating: 3.5 out of 5`; showing the number helps all users), an `aria-valuetext` repeating that score (e.g. `3.5 out of 5`) so screen readers do not announce a percentage such as "70 percent", and text fallback content inside `<meter>` stating the value (e.g. `3.5 out of 5`). Keep the visible text, `aria-valuetext` and `value` in sync when the score changes. Reset native styling on `meter.rating`, apply `--_stars-bg` and `--_stars-mask`, and clear the native WebKit and Firefox meter pseudo-elements:

```css
meter.rating {
  appearance: none;
  display: block;
  padding: 0;
  border: 0;
  background: var(--_stars-bg);
  mask: var(--_stars-mask);

  &::-moz-meter-bar {
    appearance: none;
    border: 0;
    background: none;
  }

  &::-webkit-meter-bar,
  &::-webkit-meter-optimum-value,
  &::-webkit-meter-suboptimum-value,
  &::-webkit-meter-even-less-good-value {
    appearance: none;
    border: 0;
    background: none;
  }

  &::-webkit-meter-bar {
    block-size: 100%;
    inline-size: 100%;
  }
}
```

## Interactive rating: a styled range input

Use `<input type="range" class="rating" min="0" max="5" step="0.5" value="0" aria-valuetext="Not rated">` (adjust `max` and `step` for other scales or whole-star increments) with an associated visible `<label>` and an `aria-valuetext` stating the scale (e.g. `"2.5 out of 5 stars"`, or `"Not rated"` in the unedited initial state, reporting `"0 out of 5 stars"` after interaction unless `0` explicitly represents clearing the rating). If you show a visible `<output for="...">`, set `aria-hidden="true"` on it so screen readers do not announce every change twice alongside `aria-valuetext`.

Reset the range input's native styling, add a visible `:focus-visible` outline with at least 3:1 contrast (offset so it clears the stars), and size its track to `(max - min + step) * star-size` with a `step`-wide invisible thumb (see {{ GUIDE_REF("slider") }}). That places the `0` zone to the left of the first star and centers every step on its visual star or half-star so native clicks select the right star without JS. Paint the stars on the separate WebKit and Firefox track pseudo-elements—clipped past the leading `0` offset—so the focus ring on the input is never clipped:

```css
input[type="range"].rating {
  --min: attr(min type(<number>), 0);
  --step: attr(step type(<number>), 1);
  --_offset: calc((var(--step) - var(--min)) * var(--star-size));
  --_raw-preview: calc(var(--min) - var(--step) / 2 + var(--pointer-x) * (var(--max) - var(--min) + var(--step)));
  --_preview-value: clamp(var(--min), round(nearest, var(--_raw-preview), var(--step)), var(--max));
  --_display-value: var(--_preview-value, var(--control-value));
  inline-size: calc((var(--max) - var(--min) + var(--step)) * var(--star-size));
  appearance: none;
  margin: 0;
  border: 0;
  background: transparent;
  cursor: pointer;

  &::-webkit-slider-runnable-track {
    block-size: 100%;
    background: var(--_stars-bg);
    mask: var(--_stars-mask);
    mask-position: var(--_offset) 0;
    clip-path: inset(0 0 0 var(--_offset));
  }

  &::-moz-range-track {
    block-size: 100%;
    background: var(--_stars-bg);
    mask: var(--_stars-mask);
    mask-position: var(--_offset) 0;
    clip-path: inset(0 0 0 var(--_offset));
  }

  /* Step-wide thumb aligns native step snapping with star halves without JS */
  &::-webkit-slider-thumb {
    appearance: none;
    inline-size: calc(var(--step) * var(--star-size));
    block-size: 100%;
    background: transparent;
  }

  &::-moz-range-thumb {
    inline-size: calc(var(--step) * var(--star-size));
    block-size: 100%;
    border: 0;
    background: transparent;
  }
}
```

On `input` (and on initial load), set `--control-value` on `range` to `range.value` via `style.setProperty()` (the `value` attribute only provides the initial default through `attr()`, and does not track the live value), and update `aria-valuetext` (and any visible `<output>`) to a human-readable string such as `"2.5 out of 5 stars"`.

Preview the rating on pointer hover by setting a normalized `--pointer-x` (`0` to `1`, clamped from `(event.clientX - left) / width` via `range.getBoundingClientRect()`) on `pointermove`—skipping `event.pointerType === 'touch'` and `range.disabled`—and calling `range.style.removeProperty('--pointer-x')` on `pointerleave` and `pointercancel`.

<!-- Maintainer note: because CSS computes --_preview-value solely from --pointer-x, this script can be replaced directly with CSS pointer-animations-1 (animation-timeline: pointer(...)) once supported. -->

Optional: to show an existing average until the user rates, set `data-average="3.7"` on `input[type="range"].rating` (since `--control-value` is not constrained by `step`, the displayed average does not need to be quantized to it), override `--color-star-filled: var(--color-star-average)` on `.rating[data-average]:not([data-edited]):not(:hover)` with a distinct color, and initialize `--control-value` and `aria-valuetext` (e.g. `"Not rated, average 3.7 out of 5 stars"`) from `dataset.average` until the first `input` sets `range.dataset.edited = ''`.

## Fallbacks

### attr()

{{ BASELINE_STATUS("attr") }}

`attr()` with a type keeps the custom properties in sync with the attributes without script, but it is not available everywhere. Where it is unsupported, the `--min`, `--max`, `--step`, and `--control-value` assignments on `<meter>` and `<input type="range">` need a script fallback. Detect it and copy the attributes into the properties:

```js
if (!CSS.supports('width', 'attr(value type(<number>), 0)')) {
  for (const el of document.querySelectorAll('meter.rating, input[type="range"].rating')) {
    el.style.setProperty('--min', el.getAttribute('min') ?? 0);
    el.style.setProperty('--max', el.getAttribute('max') ?? 5);
    el.style.setProperty('--step', el.getAttribute('step') ?? 1);
    el.style.setProperty('--control-value', el.getAttribute('value') ?? 0);
  }
}
```
