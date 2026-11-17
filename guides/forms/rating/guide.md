---
name: rating
description: Build a rating component that allows users to provide feedback on a scale (e.g., 1 to 5 stars), with support for half ratings.
web-feature-ids:
  - meter
  - input-range
  - attr
  - registered-custom-properties
guides:
  - icons
---

# Star rating

Build a star rating that supports half stars. Pick exactly one variant from the task before writing any markup or CSS:

* **Read-only** (`<meter>`): displays an existing score.
* **Interactive** (`<input type="range">`): collects a user rating, optionally displaying an average score in a distinct fill until edited. This is the default when the task is ambiguous.

Do not build a rating from radio buttons, clickable `<span>`s, or ARIA `slider` roles—the native range input already provides keyboard, pointer, touch, and assistive technology behavior.

## Draw the stars with a mask and a gradient

Define custom properties for `--star-size` (at least `3rem` so each half star is `1.5rem` / `24px`, shrinking via `clamp()` only on very narrow viewports), filled and empty colors for light and dark schemes, and `--icon-star` holding a `url()` to a star icon, such as an SVG file or data URI (see {{ GUIDE_REF("icons") }}). Repeat `--icon-star` `--max` times (default `5`) with `repeat-x` as a `mask` over a hard-stop `linear-gradient` driven by a registered `--control-value` `<number>`.

```css
/* Registered so the value is a typed number that calc() can use */
@property --control-value {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

:root {
  --color-star-filled: #fbbf24;
  --color-star-empty: light-dark(#c9c9d4, #4a4a58);
}

.rating {
  --max: 5;
  --_offset: 0px;
  inline-size: calc(var(--star-size) * var(--max));
  block-size: var(--star-size);
  /* Hard stop at offset + control-value fills partial and half stars */
  --_stars-bg: linear-gradient(to right in oklch,
      var(--color-star-filled) calc(var(--_offset) + var(--control-value) * var(--star-size)),
      var(--color-star-empty) 0);
  --_stars-mask: var(--icon-star) var(--_offset) 0 / var(--star-size) var(--star-size) repeat-x;
}
```

**Limitation:** a single `mask` and `linear-gradient` shares one silhouette for both filled and empty stars, so it cannot render different icons (such as an outlined empty star and a solid filled star). When you need distinct icons, position `::before` (full width, masked with the empty icon) and `::after` (width `calc(var(--control-value) / var(--max) * 100%)`, masked with the filled icon) over a wrapper element such as the `<label>` itself.

## Read-only rating: a meter

For an average or non-editable score, use `<meter class="rating" min="0" max="5" value="3.5">` with an accessible name via `aria-labelledby` or a `<label>`, and text fallback content inside `<meter>` stating the value (e.g. `3.5 out of 5`). Set `appearance: none; display: block; padding: 0; border: 0;` on `meter.rating`, apply `--_stars-bg` and `--_stars-mask`, read `--max` and `--control-value` from `max` and `value` via typed `attr()`, and clear the native WebKit meter pseudo-elements:

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

## Optional: animate the meter from zero

Worth adding when the score is a highlight (such as a product header or review summary) rather than repeated in a list. Because `--control-value` is a registered `<number>`, animate it from `0` using a keyframe with no `to` stop so it settles at the meter's own `--control-value` value, gated behind an `.animate` class and disabled under `prefers-reduced-motion: reduce`:

```css
@keyframes fill-stars {
  from { --control-value: 0; }
}

meter.rating.animate {
  animation: fill-stars 1.2s cubic-bezier(0.22, 1, 0.36, 1) both; /* example timing */
}

@media (prefers-reduced-motion: reduce) {
  meter.rating.animate { animation: none; }
}
```

Trigger the animation by adding `.animate` in the markup on load, once via `IntersectionObserver` when scrolled into view, or by removing and re-adding `.animate` (with a forced reflow) to replay. Do not re-animate from zero when the meter's value updates later.

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

Optional: to show an existing average until the user rates, set `data-average="3.5"` on `input[type="range"].rating`, override `--color-star-filled: var(--color-star-average)` on `.rating[data-average]:not([data-edited])` with a distinct color, and initialize `--control-value` and `aria-valuetext` (e.g. `"Not rated, average 3.5 out of 5 stars"`) from `dataset.average` until the first `input` sets `range.dataset.edited = ''`.

## Forced colors and motion

In forced-colors mode, background colors are overridden, so redraw the stars with system colors while opting out of color adjustment. Under `prefers-reduced-motion: reduce`, also disable any `--control-value` transition or press animation on `.rating`.

```css
@media (forced-colors: active) {
  .rating {
    --_stars-bg: linear-gradient(to right in oklch, Highlight calc(var(--_offset) + var(--control-value) * var(--star-size)), GrayText 0);
    forced-color-adjust: none;
  }
}
```

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

### Registered custom properties

{{ BASELINE_STATUS("registered-custom-properties") }}

Without `@property`, `--control-value` is an untyped value. The interactive stars and the meter still fill correctly because the gradient only reads the number, but the fill jumps instead of easing and the optional meter count-up does not run. This is graceful degradation: no extra code is needed.
