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

Build a 5-star rating that supports half stars. Pick exactly one variant from the task before writing any markup or CSS:

* **Read-only** (`<meter>`): displays an existing score.
* **Interactive** (`<input type="range">`): collects a user rating, optionally displaying an average score in a distinct fill until edited. This is the default when the task is ambiguous.

Do not build a rating from radio buttons, clickable `<span>`s, or ARIA `slider` roles—the native range input already provides keyboard, pointer, touch, and assistive technology behavior.

## Draw the stars with a mask and a gradient

Define custom properties for `--star-size` (at least `3rem` so each half star is `1.5rem` / `24px`, shrinking via `clamp()` only on very narrow viewports), filled, empty, and outline colors for light and dark schemes, and `--icon-star` holding a star SVG data URI (see {{ GUIDE_REF("icons") }}). Repeat `--icon-star` five times as a `mask` over a hard-stop `linear-gradient` driven by a registered `--rating` `<number>`. Because a `mask` clips anything outside the star silhouette, draw the outline with chained `drop-shadow()` filters on a wrapper element rather than on the masked element itself.

```css
/* Registered so the value is a typed number that calc() can use */
@property --rating {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

.stars {
  inline-size: calc(var(--star-size) * 5);
  block-size: var(--star-size);
  /* Hard stop at rating/5 of the width fills partial and half stars */
  background: linear-gradient(to right in oklch,
      var(--star-filled) calc(var(--rating) / 5 * 100%),
      var(--star-empty) 0);
  mask: var(--icon-star) 0 0 / var(--star-size) var(--star-size) repeat-x;
}

/* Outline via wrapper drop-shadows so the mask does not clip it.
   List `.rating` only in the interactive variant and `.star-frame` only in the read-only variant. */
.star-frame,
.rating {
  filter: drop-shadow(1px 0 0 var(--star-outline)) drop-shadow(-1px 0 0 var(--star-outline)) drop-shadow(0 1px 0 var(--star-outline)) drop-shadow(0 -1px 0 var(--star-outline));
}
```

The outline, not the fill, is the star's boundary, so it must have at least 3:1 contrast against the background in light and dark schemes. This is what lets the fill be a bright yellow.

## Read-only rating: a meter

For an average or non-editable score, use `<meter class="stars" min="0" max="5" value="3.5">` inside `<span class="star-frame">` (with `display: inline-block` for the outline), an accessible name via `aria-labelledby` or a `<label>`, and text fallback content inside `<meter>` stating the value (e.g. `3.5 out of 5`). Set `appearance: none; display: block; padding: 0; border: 0;` on `meter.stars`, read `--rating` from `value` via typed `attr()`, and clear the native WebKit meter pseudo-elements:

```css
meter.stars {
  --rating: attr(value type(<number>), 0);

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

meter.stars.animate {
  animation: fill-stars 1.2s cubic-bezier(0.22, 1, 0.36, 1) both; /* example timing */
}

@media (prefers-reduced-motion: reduce) {
  meter.stars.animate { animation: none; }
}
```

Trigger the animation by adding `.animate` in the markup on load, once via `IntersectionObserver` when scrolled into view, or by removing and re-adding `.animate` (with a forced reflow) to replay. Do not re-animate from zero when the meter's value updates later.

## Interactive rating: a transparent range input over the stars

MANDATORY: use `<input type="range" min="0" max="5" step="0.5">` with a visible `<label>` and an `aria-valuetext` stating the scale (e.g. `"2.5 out of 5 stars"`, or `"Not rated"` at `0`). Use `step="1"` for whole stars only. If you show a visible `<output>`, set `aria-hidden="true"` on it so screen readers do not announce every change twice alongside `aria-valuetext`.

```html
<label for="rate">Rate this product</label>
<span class="rating" id="rating-wrap">
  <input type="range" id="rate" min="0" max="5" step="0.5" value="0" aria-valuetext="Not rated" />
</span>
<output for="rate" id="rate-out" aria-hidden="true">Not rated</output>
```

Style `.rating` with `position: relative; display: inline-block;` and horizontal `padding-inline` gutters (e.g. `--rating-gutter: 0.75rem`) for easy `0` and `5` clicks. Paint the `.stars` mask and gradient on `.rating::before` (`content: ""; display: block; pointer-events: none;`) rather than on the input or wrapper, so the mask never clips the wrapper's focus ring, and style `.rating:has(:focus-visible)` with a visible `outline` and `outline-offset`. Position the range input over it (`position: absolute; inset-block: 0; margin: 0; padding: 0; border: 0; opacity: 0; appearance: none;`), excluding the gutters and collapsing the thumb to zero width so pointer coordinates map 1:1 to values:

```css
.rating input[type="range"] {
  inset-inline-start: var(--rating-gutter);
  inline-size: calc(var(--star-size) * 5);
  block-size: 100%;

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

MANDATORY: on `input` (and on initial load), mirror `range.value` into `--rating` via `wrap.style.setProperty('--rating', value)` and update `aria-valuetext` (and any visible `<output>`) to a human-readable string such as `"2.5 out of 5 stars"`.

Optional: to show an existing average until the user rates, set `data-average="3.5"` on `.rating`, override `--star-filled: var(--star-average)` on `.rating[data-average]:not([data-edited])` with a distinct color, and initialize `--rating` and `aria-valuetext` (e.g. `"Not rated, average 3.5 out of 5 stars"`) from `dataset.average` until the first `input` sets `wrap.dataset.edited = ''`.

Optional: a native range snaps clicks to the nearest step, so clicking the right side of a star can pick the left half. On pointer clicks (`event.detail !== 0`, keeping keyboard behavior native), you can snap up to the clicked half and unfill by `0.5` if the user clicks the current value again:

```js
let valueBefore = 0;
wrap.addEventListener('pointerdown', () => { valueBefore = Number(range.value); });
wrap.addEventListener('click', (event) => {
  if (event.detail === 0) return;
  const { left, width } = range.getBoundingClientRect();
  const half = Math.min(10, Math.max(0, Math.ceil(((event.clientX - left) / width) * 10))) / 2;
  range.value = half === valueBefore ? half - 0.5 : half;
  update();
});
```

## Forced colors and motion

In forced-colors mode, background colors are overridden, so clear the drop-shadow filter and redraw the stars with system colors while opting out of color adjustment (keep only the selectors for the variant you built). Under `prefers-reduced-motion: reduce`, also disable any `--rating` transition or press animation on `.rating`.

```css
@media (forced-colors: active) {
  .star-frame,
  .rating {
    filter: none;
  }

  .rating::before,
  .stars {
    background: linear-gradient(to right in oklch, Highlight calc(var(--rating) / 5 * 100%), GrayText 0);
    forced-color-adjust: none;
  }
}
```

## Fallbacks

### attr()

{{ BASELINE_STATUS("attr") }}

`attr()` with a type is not available everywhere, so the `--rating` assignment on `<meter>` needs a script fallback. Detect it and copy the attribute into the property:

```js
if (!CSS.supports('width', 'attr(value type(<number>), 0)')) {
  for (const el of document.querySelectorAll('meter.stars')) {
    el.style.setProperty('--rating', el.getAttribute('value'));
  }
}
```

The experience is identical; only the mechanism differs. The interactive range input does not depend on `attr()` because its script already sets `--rating`.

### Registered custom properties

{{ BASELINE_STATUS("registered-custom-properties") }}

Without `@property`, `--rating` is an untyped value. The interactive stars and the meter still fill correctly because the gradient only reads the number, but the fill jumps instead of easing and the optional meter count-up does not run. This is graceful degradation: no extra code is needed.
