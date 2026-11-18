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

Define custom properties for `--star-size` (at least `3rem` so each half star is `1.5rem` / `24px`, shrinking via `clamp()` only on very narrow viewports), filled and empty colors for light and dark schemes, and `--icon-star` holding a `url()` to a star icon, such as an SVG file or data URI (see {{ GUIDE_REF("icons") }}). Repeat `--icon-star` `--max` times (default `5`) with `repeat-x` as a `mask` over a hard-stop `linear-gradient` driven by `--control-value`. In forced-colors mode, override the star colors with `light-dark(CanvasText, Highlight)` for filled stars and a `color-mix()` of `CanvasText` and `Canvas` for empty stars (so contrast with `Canvas` holds in any scheme) and opt out of color adjustment.

```css
:root {
  --color-star-filled: #fbbf24;
  --color-star-empty: light-dark(#c9c9d4, #4a4a58);
}

.rating {
  --max: 5;
  --_offset: 0px;
  --_display-value: var(--control-value);
  inline-size: calc(var(--star-size) * var(--max));
  block-size: var(--star-size);
  /* Hard stop at offset + display-value fills partial and half stars */
  --_stars-bg: linear-gradient(to right in oklch,
      var(--color-star-filled) calc(var(--_offset) + var(--_display-value) * var(--star-size)),
      var(--color-star-empty) 0);
  --_stars-mask: var(--icon-star) var(--_offset) 0 / var(--star-size) var(--star-size) repeat-x;

  @media (forced-colors: active) {
    --color-star-filled: light-dark(CanvasText, Highlight);
    --color-star-average: light-dark(CanvasText, Highlight);
    --color-star-empty: color-mix(in srgb, CanvasText 40%, Canvas);
    forced-color-adjust: none;

    &::-webkit-meter-bar,
    &::-webkit-slider-runnable-track,
    &::-moz-range-track,
    &::-webkit-slider-thumb,
    &::-moz-range-thumb {
      forced-color-adjust: none;
    }
  }
}
```

**Limitation:** a single `mask` and `linear-gradient` shares one silhouette for both filled and empty stars, so it cannot render different icons (such as an outlined empty star and a solid filled star). When you need distinct icons, either combine comma-separated `mask` layers on the same element (clipping the filled icon mask to `--control-value` and compositing with the empty icon), or position `::before` (full width, masked with the empty icon) and `::after` (width `calc(var(--control-value) / var(--max) * 100%)`, masked with the filled icon) over a wrapper element such as the `<label>` itself.

To transition or animate the fill, mirror `--control-value` into a component-specific `@property` (`syntax: "<number>"`) rather than registering `--control-value` directly, and disable any transition or press animation under `prefers-reduced-motion: reduce`.

## Read-only rating: a meter

For an average or non-editable score, use `<meter class="rating" min="0" max="5" value="3.5">` with an accessible name via `aria-labelledby` pointing at visible text that includes the score (e.g. `Average rating: 3.5 out of 5`; showing the number helps all users), an `aria-valuetext` repeating that score (e.g. `3.5 out of 5`) so screen readers do not announce a percentage such as "70 percent", and text fallback content inside `<meter>` stating the value (e.g. `3.5 out of 5`). Keep the visible text, `aria-valuetext` and `value` in sync when the score changes. Set `appearance: none; display: block; padding: 0; border: 0;` on `meter.rating`, apply `--_stars-bg` and `--_stars-mask`, read `--max` and `--control-value` from `max` and `value` via typed `attr()`, and clear the native WebKit meter pseudo-elements:

```css
meter.rating {
  appearance: none;
  display: block;
  padding: 0;
  border: 0;
  --max: attr(max type(<number>), 5);
  --control-value: attr(value type(<number>), 0);
  background: var(--_stars-bg);
  mask: var(--_stars-mask);

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

Use `<input type="range" class="rating" min="0" max="5" step="0.5">` (adjust `max` and `step` for other scales or whole-star increments) with a visible `<label>` and an `aria-valuetext` stating the scale (e.g. `"2.5 out of 5 stars"`, or `"Not rated"` at `0`). If you show a visible `<output>`, set `aria-hidden="true"` on it so screen readers do not announce every change twice alongside `aria-valuetext`.

```html
<label for="rate">Rate this product</label>
<input type="range" class="rating" id="rate" min="0" max="5" step="0.5" value="0" aria-valuetext="Not rated" />
<output for="rate" id="rate-out" aria-hidden="true">Not rated</output>
```

Reset the range input's native styling and size its track to `(max - min + step) * star-size` with a `step`-wide invisible thumb. That places the `0` zone to the left of the first star and centers every step on its visual star or half-star so native clicks select the right star without JS. Paint the stars on the track pseudo-elements—clipped past the leading `0` offset—so the focus ring on the input is never clipped:

```css
input[type="range"].rating {
  --min: 0;
  --step: 0.5;
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

  &:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 6px;
  }

  &::-webkit-slider-runnable-track {
    block-size: 100%;
    background: var(--_stars-bg);
    mask: var(--_stars-mask);
    clip-path: inset(0 0 0 var(--_offset));
  }

  &::-moz-range-track {
    block-size: 100%;
    background: var(--_stars-bg);
    mask: var(--_stars-mask);
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

On `input` (and on initial load), mirror `range.min`, `range.max`, `range.step`, and `range.value` into `--min`, `--max`, `--step`, and `--control-value` on `range` via `style.setProperty()`, and update `aria-valuetext` (and any visible `<output>`) to a human-readable string such as `"2.5 out of 5 stars"`.

Preview the rating on pointer hover by writing a generic normalized `--pointer-x` (`0` to `1`) on `pointermove` (skipping `touch` and disabled inputs) and clearing it on `pointerleave` and `pointercancel`:

<!-- Maintainer note: because CSS computes --_preview-value solely from --pointer-x, this script can be replaced directly with CSS pointer-animations-1 (animation-timeline: pointer(...)) once supported. -->

```js
range.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch' || range.disabled) return;
  const { left, width } = range.getBoundingClientRect();
  const pointerX = Math.min(1, Math.max(0, (event.clientX - left) / width));
  range.style.setProperty('--pointer-x', pointerX);
});
for (const type of ['pointerleave', 'pointercancel']) {
  range.addEventListener(type, () => range.style.removeProperty('--pointer-x'));
}
```

Optional: to show an existing average until the user rates, set `data-average="3.5"` on `input[type="range"].rating`, override `--color-star-filled: var(--color-star-average)` on `.rating[data-average]:not([data-edited]):not(:hover)` with a distinct color, and initialize `--control-value` and `aria-valuetext` (e.g. `"Not rated, average 3.5 out of 5 stars"`) from `dataset.average` until the first `input` sets `range.dataset.edited = ''`.

## Fallbacks

### attr()

{{ BASELINE_STATUS("attr") }}

`attr()` with a type is not available everywhere, so the `--max` and `--control-value` assignments on `<meter>` need a script fallback. Detect it and copy the attributes into the properties:

```js
if (!CSS.supports('width', 'attr(value type(<number>), 0)')) {
  for (const el of document.querySelectorAll('meter.rating')) {
    el.style.setProperty('--max', el.getAttribute('max') ?? 5);
    el.style.setProperty('--control-value', el.getAttribute('value'));
  }
}
```

The experience is identical; only the mechanism differs. The interactive range input does not depend on `attr()` because its script already sets `--control-value`.
