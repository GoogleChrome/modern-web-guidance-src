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

Build a 5-star rating that supports half stars. Use a native `<input type="range">` for input and a native `<meter>` for read-only display, and draw the stars with CSS. Do not build a rating from radio buttons, clickable `<span>`s, or ARIA `slider` roles: the range input already provides keyboard, pointer, touch, and assistive technology behavior.

## 1. Draw the stars with a mask and a gradient

Store the star as an SVG data URI in a custom property (the same icon-token approach as {{ GUIDE_REF("icons") }}). Repeat it five times as a `mask` over a hard-stop gradient. The gradient's filled portion is driven by a registered `--rating` number, so any fractional value, including half stars, renders correctly with no extra markup.

```css
/* Registered so the value is a typed number that calc() can use */
@property --rating {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

:root {
  --star-filled: light-dark(#d97706, #fbbf24);
  --star-empty: light-dark(#c9c9d4, #4a4a58);
  --star-size: 3rem; /* example value; with half stars each half is 1.5rem (24px), the minimum touch target */
  --icon-star: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'/%3E%3C/svg%3E");
}

.stars {
  inline-size: calc(var(--star-size) * 5);
  block-size: var(--star-size);
  /* Two stops at the same position make a hard edge at rating/5 of the width */
  background: linear-gradient(to right in oklch,
      var(--star-filled) calc(var(--rating) / 5 * 100%),
      var(--star-empty) 0);
  mask: var(--icon-star) 0 0 / var(--star-size) var(--star-size) repeat-x;
}
```

Both colors must have at least 3:1 contrast against the background in light and dark schemes.

## 2. Interactive rating: a transparent range input over the stars

MANDATORY: use `<input type="range" min="0" max="5" step="0.5">` with a visible `<label>`. The `step` is what enables half stars; use `step="1"` for whole stars only.

Make the input invisible (`opacity: 0`), stretch it over the stars, and collapse the thumb to zero width so the pointer position maps exactly to the value. Paint the stars on a `::before` of the wrapper, not on the input or the wrapper itself: a `mask` would clip the focus ring.

```html
<label for="rate">Rate this product</label>
<span class="rating" id="rating-wrap">
  <input type="range" id="rate" min="0" max="5" step="0.5" value="0" />
</span>
<!-- Hidden from assistive technology: <output> is a live region, so it would announce every change a second time. The range's aria-valuetext already speaks the value. -->
<output for="rate" id="rate-out" aria-hidden="true">Not rated</output>
```

```css
.rating {
  position: relative;
  display: inline-block;
  /* Optional: because --rating is registered, the fill can ease to the new value (example duration) */
  transition: --rating 0.25s ease-out;

  /* Same painting as .stars, on a pseudo-element so the focus ring is not masked */
  &::before {
    content: "";
    display: block;
    pointer-events: none;
    inline-size: calc(var(--star-size) * 5);
    block-size: var(--star-size);
    background: linear-gradient(to right in oklch,
        var(--star-filled) calc(var(--rating) / 5 * 100%),
        var(--star-empty) 0);
    mask: var(--icon-star) 0 0 / var(--star-size) var(--star-size) repeat-x;
  }

  /* The input is invisible, so draw the focus ring on the wrapper */
  &:has(:focus-visible) {
    outline: 3px solid;
    outline-offset: 6px;
  }

  & input[type="range"] {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
    appearance: none;

    /* A zero-width thumb keeps the value-to-position mapping exact */
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
}
```

MANDATORY: mirror the value into `--rating` and give it a human-readable `aria-valuetext`, because "2.5" alone does not say what the scale is.

```js
const range = document.getElementById('rate');
const wrap = document.getElementById('rating-wrap');
const out = document.getElementById('rate-out');

function update() {
  const value = Number(range.value);
  const text = value === 0 ? 'Not rated' : `${value} out of 5 stars`;
  wrap.style.setProperty('--rating', value);
  range.setAttribute('aria-valuetext', text);
  out.textContent = text;
}
range.addEventListener('input', update);
update();
```

Optional: a native range snaps a click to the nearest step, so clicking the right side of a star can give the left half. Worth adding for star ratings, because people expect a click to fill the half they hit and a second click on the last filled half to unfill it. It is not needed when a nearest-step result is acceptable.

```js
// Pointer clicks fill the half under the pointer; clicking the last filled half unfills it
let valueBefore = 0;
range.addEventListener('pointerdown', () => { valueBefore = Number(range.value); });
range.addEventListener('click', (event) => {
  if (event.detail === 0) return; // keyboard-initiated clicks keep native behavior
  const { left, width } = range.getBoundingClientRect();
  const half = Math.ceil(((event.clientX - left) / width) * 10) / 2; // snap up to the half under the pointer
  range.value = half === valueBefore ? half - 0.5 : half;
  update();
});
```

## 3. Read-only rating: a meter

For an average or other non-editable score, use `<meter min="0" max="5" value="3.5">` with the `.stars` class and an accessible name (`aria-labelledby` or a label). Put a text value inside the element as fallback content. Remove the native appearance, and make the WebKit bar and value pseudo-elements transparent so only the mask-and-gradient stars show.

```css
meter.stars {
  appearance: none;
  display: block;
  border: 0;
  /* Reads the value attribute as a number so no script is needed */
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

## 4. Optional: animate the meter from zero

Worth adding when the score is a highlight (a product header or review summary) and not when many meters appear in a list. Because `--rating` is a registered `<number>`, it can be animated like any other value. Leave the keyframe's `to` out so it animates to whatever the meter's value is, and gate the animation behind a class so the trigger is yours to choose.

```css
@keyframes fill-stars {
  from { --rating: 0; }
}

/* Duration and easing are example values */
meter.stars.animate {
  animation: fill-stars 1.2s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@media (prefers-reduced-motion: reduce) {
  meter.stars.animate { animation: none; }
}
```

Starting or restarting the animation is just adding the class, so any trigger works. Removing and re-adding the class (with a forced reflow in between) restarts it.

```js
function replay(el) {
  el.classList.remove('animate');
  void el.offsetWidth; // forces a reflow so the animation restarts
  el.classList.add('animate');
}
```

Pick the trigger that fits:

* **On page load:** put `class="stars animate"` in the markup. Use this for meters visible without scrolling.
* **When scrolled into view:** use an `IntersectionObserver` that calls `replay(meter)` once, then disconnects. Use this for meters below the fold, so the animation isn't spent before the user sees it.
* **On another event** (a tab opening, data finishing loading, a "replay" button): call `replay(meter)` from that handler.

```js
new IntersectionObserver((entries, observer) => {
  if (entries.some((entry) => entry.isIntersecting)) {
    replay(meter);
    observer.disconnect();
  }
}, { threshold: 0.6 }).observe(meter); // threshold is an example value
```

If the meter's value changes later, do not animate from zero again; the range-input path already updates `--rating` directly.

## 5. Forced colors and motion

In forced-colors mode, background colors are overridden, so the stars would lose their filled and empty distinction. Re-declare the gradient with system colors and opt out of adjustment.

```css
@media (forced-colors: active) {
  .rating::before,
  .stars {
    background: linear-gradient(to right in oklch, Highlight calc(var(--rating) / 5 * 100%), GrayText 0);
    forced-color-adjust: none;
  }
}
```

Disable the `--rating` transition on `.rating` and any other star animation (for example a scale on press) under `prefers-reduced-motion: reduce`, as the meter animation above does.

```css
@media (prefers-reduced-motion: reduce) {
  .rating { transition: none; }
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
