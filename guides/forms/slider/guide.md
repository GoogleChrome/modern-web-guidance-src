---
name: slider
description: Style a native range slider with custom track, thumb, fill, and focus states while preserving native functionality and accessibility.
web-feature-ids:
  - accent-color
  - input-range
  - appearance
  - progress
  - attr
  - dir-pseudo
# later: ::slider-thumb, ::slider-track, ::slider-fill
guides:
  - slider-tooltip
  - brand-consistent-forms
---

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

For simple colour customisation, use {{ GUIDE_REF("brand-consistent-forms") }} and retain the browser’s native rendering:

```css
input[type="range"] {
  accent-color: var(--brand-color);
}
```

`accent-color` is not a complete slider styling API. Its effect on the thumb, track, and fill is user-agent-dependent. Use the pseudo-elements below when the track, thumb, dimensions, shape, or fill must be controlled.

## Style the track and thumb

Reset default OS styling with `appearance: none`, `margin: 0`, and `border: 0`. To normalize cross-browser rendering, declare WebKit and Firefox pseudo-elements in separate rule blocks, and center the WebKit thumb using `margin-block-start: calc((var(--slider-track-size) - var(--slider-thumb-size)) / 2)` (Firefox centers the thumb automatically). Keep consumer-facing values as custom properties on the input so themes do not target pseudo-elements directly.

```css
input[type="range"] {
  --slider-track-size: 0.5rem;
  --slider-thumb-size: 1.25rem;
  --slider-track-radius: 999px;
  --slider-thumb-radius: 50%;
  --slider-track-color: light-dark(#d9d9d9, #404040);
  --slider-fill-color: light-dark(#06c, #66b3ff);
  --slider-thumb-color: var(--slider-fill-color);
  --slider-direction: to right;

  /* reverse gradient direction for right-to-left layouts */
  &:dir(rtl) {
    --slider-direction: to left;
  }

  /* Mirror the input's min, max, and value; kept in sync by the script below. */
  --attr-min: 0;
  --attr-max: 100;
  --control-value: 50;
  --slider-progress: calc(
    (var(--control-value) - var(--attr-min)) /
    (var(--attr-max) - var(--attr-min)) * 100%
  );

  appearance: none;
  inline-size: 100%;
  block-size: 2.5rem; /* Preserve a generous interaction area. */
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  cursor: pointer;
}

/* WebKit/Blink. */
input[type="range"]::-webkit-slider-runnable-track {
  block-size: var(--slider-track-size);
  border: 0;
  border-radius: var(--slider-track-radius);
  background: linear-gradient(
    var(--slider-direction),
    var(--slider-fill-color) var(--slider-progress),
    var(--slider-track-color) var(--slider-progress)
  );
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
  border-radius: var(--slider-thumb-radius);
  background: var(--slider-thumb-color);
}

/* Firefox. */
input[type="range"]::-moz-range-track {
  block-size: var(--slider-track-size);
  border: 0;
  border-radius: var(--slider-track-radius);
  background: var(--slider-track-color);
}

input[type="range"]::-moz-range-progress {
  block-size: var(--slider-track-size);
  border-radius: var(--slider-track-radius);
  background: var(--slider-fill-color);
}

input[type="range"]::-moz-range-thumb {
  inline-size: var(--slider-thumb-size);
  block-size: var(--slider-thumb-size);
  border: 0;
  border-radius: var(--slider-thumb-radius);
  background: var(--slider-thumb-color);
}
```

Always provide a visible keyboard focus indicator after removing the native appearance. Do not use color alone:

```css
input[type="range"]:focus-visible {
  outline: 2px solid var(--slider-fill-color);
  outline-offset: 4px;
}
```

## Style the active track

The Firefox `::-moz-range-progress` pseudo-element exposes the filled portion of the track. WebKit/Blink do not provide an equivalent interoperable pseudo-element, so expose the control's `min`, `max`, and value as the `--attr-min`, `--attr-max`, and `--control-value` custom properties declared in the CSS above. The CSS derives `--slider-progress` from them, so the fill follows the control's actual range rather than assuming 0–100. Keep this enhancement small:

```js
const slider = document.querySelector('#range-slider');

function syncSliderProperties() {
  slider.style.setProperty('--attr-min', slider.min || 0);
  slider.style.setProperty('--attr-max', slider.max || 100);
  slider.style.setProperty('--control-value', slider.value);
}

syncSliderProperties();
slider.addEventListener('input', syncSliderProperties);
```

## Limitations

- Do not combine WebKit and Firefox pseudo-selectors into a single comma-separated list (e.g. `::-webkit-slider-thumb, ::-moz-range-thumb`); browsers drop the entire rule if an unrecognized vendor pseudo-element is encountered.
- Generated content on slider pseudo-elements is not interoperable and should not contain essential labels, values, instructions, or functionality. In particular, do not rely on `::before` or `::after` for cross-browser slider UI.
- Do not replace the input with a `div`, custom pointer handlers, or a second interactive control merely to obtain visual styling.

## Fallbacks

{{ FEATURE_FALLBACKS("accent-color") }}

## Future standard pseudo-elements

CSS Forms Level 1 defines standard `::slider-thumb`, `::slider-track`, and `::slider-fill` pseudo-elements. When they are sufficiently supported, prefer them in the primary implementation and move the vendor-prefixed selectors into this fallback section.
