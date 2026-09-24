---
name: slider
description: Style a native range slider with custom track, thumb, fill, and focus states while preserving native functionality and accessibility.
web-feature-ids:
  - accent-color
  - input-range
  - appearance
# later: ::slider-thumb, ::slider-track, ::slider-fill
guides:
  - slider-tooltip
---

<!--
Keep the native input. Use accent-color for simple colour changes and
appearance: none with vendor-prefixed slider pseudo-elements for deeper
customisation until the standard slider pseudo-elements are widely available.
Use GUIDE_REF for related guidance.
-->

# Brand-Consistent Range Slider

## Use the native range input

Use a labelled `<input type="range">` rather than recreating a slider with generic elements. The native control preserves semantics, keyboard and pointer interaction, touch behaviour, value constraints, and assistive-technology support. Configure `min`, `max`, `step`, and `value` for the use case.

```html
<label for="range-slider">Volume</label>
<input
  type="range"
  id="range-slider"
  value="70"
/>
```

If the numeric value needs a human-readable unit, expose the formatted value in ordinary DOM content and update `aria-valuetext` when the value changes; otherwise, let the native slider expose its numeric value.

If a tooltip that follows the thumb is required, use the {{ GUIDE_REF("slider-tooltip") }} guide.

## Choose the styling approach

For simple colour customisation, use {{ GUIDE_REF("accent-color") }} and retain the browser’s native rendering:

```css
input[type="range"] {
  accent-color: var(--brand-color);
}
```

`accent-color` is not a complete slider styling API. Its effect on the thumb, track, and fill is user-agent-dependent. Use the pseudo-elements below when the track, thumb, dimensions, shape, or fill must be controlled.

## Style the track and thumb

Use `appearance: none` on the input and the established vendor-prefixed pseudo-elements. These selectors are widely implemented but not yet standardised; they are preferable to replacing the native control with custom elements. Keep consumer-facing values on the input as custom properties so themes do not need to target pseudo-elements directly.

```css
input[type="range"] {
  --slider-track-size: 0.5rem;
  --slider-thumb-size: 1.25rem;
  --slider-track-color: light-dark(#d9d9d9, #404040);
  --slider-fill-color: light-dark(#06c, #66b3ff);
  --slider-thumb-color: var(--slider-fill-color);
  --slider-progress: 0%;
  --slider-direction: to right;

  appearance: none;
  inline-size: 100%;
  block-size: 2.5rem; /* Preserve a generous interaction area. */
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: linear-gradient(
    var(--slider-direction),
    var(--slider-fill-color) var(--slider-progress),
    var(--slider-track-color) var(--slider-progress)
  ) center / 100% var(--slider-track-size) no-repeat;
  cursor: pointer;
}

/* WebKit/Blink. */
input[type="range"]::-webkit-slider-runnable-track {
  block-size: var(--slider-track-size);
  border: 0;
  border-radius: 999px;
  background: transparent;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  inline-size: var(--slider-thumb-size);
  block-size: var(--slider-thumb-size);
  margin-block-start: calc(
    (var(--slider-track-size) - var(--slider-thumb-size)) / 2
  );
  border: 0;
  border-radius: 50%;
  background: var(--slider-thumb-color);
}

/* Firefox. */
input[type="range"]::-moz-range-track {
  block-size: var(--slider-track-size);
  border: 0;
  border-radius: 999px;
  background: transparent;
}

input[type="range"]::-moz-range-progress {
  block-size: var(--slider-track-size);
  border-radius: 999px;
  background: var(--slider-fill-color);
}

input[type="range"]::-moz-range-thumb {
  inline-size: var(--slider-thumb-size);
  block-size: var(--slider-thumb-size);
  border: 0;
  border-radius: 50%;
  background: var(--slider-thumb-color);
}
```

Always provide a visible keyboard focus indicator after removing the native appearance. Do not use colour alone:

```css
input[type="range"]:focus-visible {
  outline: 2px solid var(--slider-fill-color);
  outline-offset: 4px;
}
```

## Style the active track

The Firefox `::-moz-range-progress` pseudo-element exposes the filled portion of the track. WebKit/Blink do not provide an equivalent interoperable pseudo-element, so set a percentage custom property when the fill must be styled there. Keep this enhancement small and derive the percentage from the control’s actual `min`, `max`, and `value` rather than assuming a 0–100 range.

```js
const slider = document.querySelector('#range-slider');

function updateSliderProgress() {
  const min = Number(slider.min || 0);
  const max = Number(slider.max || 100);
  const value = Number(slider.value);
  const progress = max > min
    ? ((value - min) / (max - min)) * 100
    : 0;

  slider.style.setProperty('--slider-progress', `${progress}%`);
}

updateSliderProgress();
slider.addEventListener('input', updateSliderProgress);
```

When `control-value()` is supported, this JavaScript can move to a fallback or be removed. `progress()` and `attr()` may also provide future CSS-only implementations; do not require them until their support and value syntax are suitable for the target browsers.

## Support right-to-left layouts

Do not hard-code a left-to-right fill. Set the gradient direction from the document direction for horizontal sliders:

```css
[dir="rtl"] input[type="range"] {
  --slider-direction: to left;
}
```

## Limitations

- `::-webkit-slider-runnable-track`, `::-webkit-slider-thumb`, `::-moz-range-track`, `::-moz-range-progress`, and `::-moz-range-thumb` are browser-specific and can differ in sizing, alignment, and behaviour.
- Generated content on slider pseudo-elements is not interoperable and should not contain essential labels, values, instructions, or functionality. In particular, do not rely on `::before` or `::after` for cross-browser slider UI.
- A custom appearance does not remove the need for a programmatic label, visible focus indicator, adequate contrast, or a usable interaction area.
- Test horizontal, RTL, vertical, zoomed, high-contrast, touch, keyboard, and assistive-technology use cases in every supported browser.
- Do not replace the input with a `div`, custom pointer handlers, or a second interactive control merely to obtain visual styling.

## Fallbacks

For browsers that do not support `appearance: none` or the required slider pseudo-elements, retain the native rendering rather than recreating the control:

{{ FEATURE_FALLBACKS("appearance") }}

## Future standard pseudo-elements

CSS Forms Level 1 defines standard `::slider-thumb`, `::slider-track`, and `::slider-fill` pseudo-elements. When they are sufficiently supported, prefer them in the primary implementation and move the vendor-prefixed selectors into this fallback section.
