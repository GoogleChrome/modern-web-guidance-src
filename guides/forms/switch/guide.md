---
name: switch
description: Build an accessible switch with the native HTML switch attribute, falling back to a styled checkbox when not supported.
web-feature-ids:
  - switch-control
  - accent-color
---

# Build Accessible Switch Controls

Use the native HTML `switch` attribute when supported, with a CSS polyfill fallback for browsers that don't render it natively.

An accessible switch implementation requires:

1. **Semantic Foundation:** A standard `<input type="checkbox" role="switch" switch>` with an associated `<label>`, preserving form submission, keyboard navigation, and screen reader semantics (see {{ GUIDE_REF("checkbox") }} and {{ GUIDE_REF("forms") }}).
2. **Early Feature Detection:** A one-line JavaScript check in `<head>` that detects native switch support before first paint.
3. **Polyfill Fallback:** A concise CSS stylesheet that restyles the checkbox itself (`appearance: none` plus a `::before` thumb) in browsers lacking native support.

## Markup

Add the boolean `switch` attribute and `role="switch"` to a standard checkbox input. The role exposes switch semantics in browsers that don't implement `switch` yet.

```html
<label>
  Enable notifications
  <input id="notifications" type="checkbox" role="switch" switch>
</label>
```

- The label can wrap the input or be associated with `for`/`id`. All styling targets the input, so it doesn't depend on the label structure.
- When checked, the input submits its standard checkbox value. In JavaScript, listen for `change` (or `input`) events and read `.checked` rather than `.value`.

## Feature Detection

CSS cannot detect support for the `switch` attribute, so detect it in JavaScript with an inline script in `<head>`. It runs before first paint, so the correct implementation is selected without a flash of the wrong control:

```html
<script>
  const supportsNativeSwitch = 'switch' in HTMLInputElement.prototype;
  const root = document.documentElement;

  root.classList.toggle('native-switch', supportsNativeSwitch);
  root.classList.toggle('no-native-switch', !supportsNativeSwitch);
</script>
```

## Native Styling

When native switch support is detected, customize the control's highlight color using `accent-color` (see {{ GUIDE_REF("brand-consistent-forms") }}) and ensure visible focus styling:

```css
html.native-switch input[type="checkbox"][switch] {
  accent-color: var(--accent-color, #1769e0);
  inline-size: 3rem;
  block-size: 1.75rem;
  margin: 0;
  cursor: pointer;
}

input[type="checkbox"][switch]:focus-visible {
  outline: 3px solid var(--focus-color, #ff8c00);
  outline-offset: 4px;
}
```

## Polyfill Fallback

For browsers without native switch support, restyle the checkbox itself when the `no-native-switch` class is present. With `appearance: none`, a checkbox accepts a `::before` pseudo-element, which is used for the thumb. The input stays the single visible, focusable control, so the shared `:focus-visible` rule above applies, and it works with any label arrangement.

```css
html.no-native-switch input[type="checkbox"][switch] {
  --switch-block-size: 1.75rem;
  --switch-inline-size: 3rem;
  --switch-border-size: 2px;
  --switch-thumb-size: calc(
    var(--switch-block-size) - (2 * var(--switch-border-size))
  );

  appearance: none;
  position: relative;
  box-sizing: border-box;
  inline-size: var(--switch-inline-size);
  block-size: var(--switch-block-size);
  margin: 0;
  border: var(--switch-border-size) solid var(--border-color, #808080);
  border-radius: 999em;
  background-color: var(--track-off, #e5e5e5);
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}

/* The thumb. Logical offsets keep it correct in right-to-left layouts. */
html.no-native-switch input[type="checkbox"][switch]::before {
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: 0;
  inline-size: var(--switch-thumb-size);
  block-size: var(--switch-thumb-size);
  border-radius: 50%;
  background-color: Canvas;
  box-shadow: 0 1px 3px rgb(0 0 0 / 25%);
  content: "";
  transition: inset-inline-start 150ms ease;
}

html.no-native-switch input[type="checkbox"][switch]:checked {
  background-color: var(--accent-color, #1769e0);
  border-color: var(--accent-color, #1769e0);
}

html.no-native-switch input[type="checkbox"][switch]:checked::before {
  inset-inline-start: calc(100% - var(--switch-thumb-size));
}

@media (prefers-reduced-motion: reduce) {
  html.no-native-switch input[type="checkbox"][switch],
  html.no-native-switch input[type="checkbox"][switch]::before {
    transition: none;
  }
}
```

## Fallbacks & Browser Support

{{ BASELINE_STATUS("switch-control") }}

{{ BASELINE_STATUS("accent-color") }}
