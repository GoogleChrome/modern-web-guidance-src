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

Define custom properties for `--star-size` (at least `3rem` so each half star is `1.5rem` / `24px`, shrinking via `clamp()` only on very narrow viewports), filled and empty colors for light and dark schemes, and `--icon-star` holding a `url()` to a star icon, such as an SVG file or data URI (see {{ GUIDE_REF("icons") }}). Repeat `--icon-star` `--max` times (default `5`) with `repeat-x` as a `mask` over a hard-stop `linear-gradient` driven by a registered `--rating` `<number>`.

```css
/* Registered so the value is a typed number that calc() can use */
@property --rating {
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
  inline-size: calc(var(--star-size) * var(--max));
  block-size: var(--star-size);
  /* Hard stop at rating/max of the width fills partial and half stars */
  --_stars-bg: linear-gradient(to right in oklch,
      var(--color-star-filled) calc(var(--rating) / var(--max) * 100%),
      var(--color-star-empty) 0);
  --_stars-mask: var(--icon-star) 0 0 / var(--star-size) var(--star-size) repeat-x;
}
```

**Limitation:** a single `mask` and `linear-gradient` shares one silhouette for both filled and empty stars, so it cannot render different icons (such as an outlined empty star and a solid filled star). When you need distinct icons, position `::before` (full width, masked with the empty icon) and `::after` (width `calc(var(--rating) / var(--max) * 100%)`, masked with the filled icon) over a wrapper element such as the `<label>` itself.

## Read-only rating: a meter

For an average or non-editable score, use `<meter class="rating" min="0" max="5" value="3.5">` with an accessible name via `aria-labelledby` or a `<label>`, and text fallback content inside `<meter>` stating the value (e.g. `3.5 out of 5`). Set `appearance: none; display: block; padding: 0; border: 0;` on `meter.rating`, apply `--_stars-bg` and `--_stars-mask`, read `--max` and `--rating` from `max` and `value` via typed `attr()`, and clear the native WebKit meter pseudo-elements:

```css
meter.rating {
  appearance: none;
  display: block;
  padding: 0;
  border: 0;
  --max: attr(max type(<number>), 5);
  --rating: attr(value type(<number>), 0);
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

Worth adding when the score is a highlight (such as a product header or review summary) rather than repeated in a list. Because `--rating` is a registered `<number>`, animate it from `0` using a keyframe with no `to` stop so it settles at the meter's own `--rating` value, gated behind an `.animate` class and disabled under `prefers-reduced-motion: reduce`:

```css
@keyframes fill-stars {
  from { --rating: 0; }
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

Reset the range input's native styling and add horizontal padding gutters for easy min and max clicks. Paint the stars on the track pseudo-elements so the focus ring is never clipped by the mask, and collapse the thumb to zero width so pointer coordinates map 1:1 to values:

```css
input[type="range"].rating {
  --rating-gutter: 0.75rem;
  appearance: none;
  box-sizing: content-box;
  padding-inline: var(--rating-gutter);
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
  }

  &::-moz-range-track {
    block-size: 100%;
    background: var(--_stars-bg);
    mask: var(--_stars-mask);
  }

  /* Zero-width thumb keeps value-to-position mapping exact */
  &::-webkit-slider-thumb {
    appearance: none;
    inline-size: 0;
    block-size: 0;
  }

  &::-moz-range-thumb {
    inline-size: 0;
    block-size: 0;
    border: 0;
  }
}
```

On `input` (and on initial load), mirror `range.max` into `--max` and `range.value` into `--rating` on `range` via `style.setProperty()`, and update `aria-valuetext` (and any visible `<output>`) to a human-readable string such as `"2.5 out of 5 stars"`.

Optional: to show an existing average until the user rates, set `data-average="3.5"` on `input[type="range"].rating`, override `--color-star-filled: var(--color-star-average)` on `.rating[data-average]:not([data-edited])` with a distinct color, and initialize `--rating` and `aria-valuetext` (e.g. `"Not rated, average 3.5 out of 5 stars"`) from `dataset.average` until the first `input` sets `range.dataset.edited = ''`.

Optional: a native range snaps clicks to the nearest step, so clicking the right side of a star can pick the left half. On pointer clicks (`event.detail !== 0`, keeping keyboard behavior native), you can snap up to the clicked step and unfill by one `step` if the user clicks the current value again:

```js
let valueBefore = 0;
range.addEventListener('pointerdown', () => { valueBefore = Number(range.value); });
range.addEventListener('click', (event) => {
  if (event.detail === 0) return;
  const rect = range.getBoundingClientRect();
  const cs = getComputedStyle(range);
  const padLeft = parseFloat(cs.paddingLeft);
  const left = rect.left + padLeft;
  const width = rect.width - padLeft - parseFloat(cs.paddingRight);
  const min = Number(range.min) || 0;
  const max = Number(range.max) || 5;
  const step = Number(range.step) || 1;
  const steps = Math.round((max - min) / step);
  const next = Math.min(max, Math.max(min, min + Math.ceil(((event.clientX - left) / width) * steps) * step));
  range.value = next === valueBefore ? Math.max(min, next - step) : next;
  update();
});
```

## Forced colors and motion

In forced-colors mode, background colors are overridden, so redraw the stars with system colors while opting out of color adjustment. Under `prefers-reduced-motion: reduce`, also disable any `--rating` transition or press animation on `.rating`.

```css
@media (forced-colors: active) {
  .rating {
    --_stars-bg: linear-gradient(to right in oklch, Highlight calc(var(--rating) / var(--max) * 100%), GrayText 0);
    forced-color-adjust: none;
  }
}
```

## Fallbacks

### attr()

{{ BASELINE_STATUS("attr") }}

`attr()` with a type is not available everywhere, so the `--max` and `--rating` assignments on `<meter>` need a script fallback. Detect it and copy the attributes into the properties:

```js
if (!CSS.supports('width', 'attr(value type(<number>), 0)')) {
  for (const el of document.querySelectorAll('meter.rating')) {
    el.style.setProperty('--max', el.getAttribute('max') ?? 5);
    el.style.setProperty('--rating', el.getAttribute('value'));
  }
}
```

The experience is identical; only the mechanism differs. The interactive range input does not depend on `attr()` because its script already sets `--rating`.

### Registered custom properties

{{ BASELINE_STATUS("registered-custom-properties") }}

Without `@property`, `--rating` is an untyped value. The interactive stars and the meter still fill correctly because the gradient only reads the number, but the fill jumps instead of easing and the optional meter count-up does not run. This is graceful degradation: no extra code is needed.
