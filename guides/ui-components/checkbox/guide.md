---
name: checkbox
description: Style checkboxes, including custom icons, layout, colors, check/uncheck animations, while preserving native functionality and accessibility.
web-feature-ids:
  - accent-color
  - indeterminate
  - individual-transforms
  - masks
---

# Styling Checkboxes

Use semantic, accessible HTML with each checkbox associated with its label, either by nesting the `<input>` inside the `<label>` or by matching the label’s `for` attribute to the input’s `id`.

Modern CSS provides two approaches to styling checkboxes: customise the native appearance with `accent-color`, or override the default presentation with `appearance: none` on the `<input type="checkbox">` element.

## Native customisation with `accent-color`

For simple, brand-consistent styling that retains native rendering, keyboard behaviour, validation, and operating-system focus indicators, use `accent-color`.

Choose an accent colour with sufficient contrast against the checkbox’s background and avoid very light colours. Although some browsers automatically select a contrasting checkmark colour, Safari may retain a light checkmark over a light accent colour. If the design requires a light accent colour or reliable control over the checkmark and other visual states, use the fully custom approach instead.

```css
.checkbox-native {
  accent-color: #1a73e8;
  
  /* Sizing is controlled via relative units */
  width: 1.25em;
  height: 1.25em;
  cursor: pointer;
}
```

## Fully custom styling with `appearance: none`

Use `appearance: none` when the design requires control over the checkbox’s
shape, size, states, or indicators. This removes the native visual styling while
leaving the `<input>` as the interactive target.

Set explicit relative sizes for `--checkbox-size` and `--checkbox-icon-size` because appearance: none removes the browser’s default dimensions. Keep the icon smaller than the checkbox to provide space for its border and visual padding.

```css
/* Reusable SVG assets */
:root {
  --icon-check: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='20 6 9 17 4 12'></polyline></svg>");
  --icon-dash: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='4.5' stroke-linecap='round' stroke-linejoin='round'><line x1='5' y1='12' x2='19' y2='12'></line></svg>");
}

/* Custom checkbox */
.checkbox-custom {
  --checkbox-size: 1.25em;
  --checkbox-icon-size: 0.7em;

  appearance: none;
  display: inline-grid;
  place-content: center;
  inline-size: var(--checkbox-size);
  aspect-ratio: 1;
  margin: 0;
  border: 2px solid currentColor;
  cursor: pointer;
}

.checkbox-custom::before {
  content: "";
  inline-size: var(--checkbox-icon-size);
  aspect-ratio: 1;
  background-color: currentColor;
  mask: var(--checkbox-icon) no-repeat center / contain;
  scale: 0;
  transition: scale 150ms ease;
}

.checkbox-custom:checked {
  --checkbox-icon: var(--icon-check);
}

.checkbox-custom:checked::before {
  scale: 1;
}

.checkbox-custom:indeterminate {
  --checkbox-icon: var(--icon-dash);
}

.checkbox-custom:indeterminate::before {
  scale: 1;
}

.checkbox-custom:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

.checkbox-custom:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
```


## The indeterminate state

When a checkbox is programmatically set to `indeterminate = true`, style the `:indeterminate` pseudo-class so the state is visually distinguishable.

* **Native (`accent-color`):** Automatically styled by the browser to match `accent-color`.
* **Custom (`appearance: none`):** Dynamically assign the `--checkbox-icon` variable to the custom dash icon.

```css
/* Native checkboxes inherit the accent color in the indeterminate state */
.checkbox-native:indeterminate {
  accent-color: #1a73e8;
}

/* Dynamically swap the custom property to the dash icon */
.checkbox-custom:indeterminate {
  --checkbox-icon: var(--icon-dash);
}

/* Animate indeterminate dash visibility */
.checkbox-custom:indeterminate::before {
  scale: 1;
}
```

## Accessibility and interaction

- **DO** use `:focus-visible` rather than `:focus` to style focus indicators on custom checkboxes. This ensures that a distinct keyboard outline is visible for accessibility, but is omitted for mouse/touch clicks.
  ```css
  .checkbox-custom:focus-visible {
    outline: 2px solid #1a73e8;
    outline-offset: 2px;
  }
  ```
- **DO NOT** use `outline: none` or hide focus indicators on checkboxes.
- **DO** ensure the checkbox or the label has an active click/touch target of at least `44px x 44px` to comply with mobile touch guidelines.
- **DO** provide a `:disabled` style variant that lowers opacity, alters background, and sets `cursor: not-allowed` to convey active states clearly.


## Fallback strategies

{{ FEATURE_FALLBACKS("accent-color") }}
{{ FEATURE_FALLBACKS("indeterminate") }}
{{ FEATURE_FALLBACKS("masks") }}
