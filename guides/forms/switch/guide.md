---
name: switch
description: Build an accessible switch with the native HTML switch attribute, JavaScript feature detection, and a polyfill fallback for non-WebKit browsers.
web-feature-ids:
  - switch-control
  - accent-color
---

# Build Accessible Switch Controls

Use the native HTML `switch` attribute when supported, but provide a visual fallback for other browsers. Native `switch` support is currently **Safari/WebKit-only** (limited availability). Because most browsers do not yet render native switches, delivering a visual polyfill is essential when a switch UI is requested.

An accessible switch implementation requires:

1. **Semantic Foundation:** A standard `<input type="checkbox" switch>` inside an associated `<label>`, preserving form submission, keyboard navigation, and screen reader semantics (see {{ GUIDE_REF("checkbox") }} and {{ GUIDE_REF("forms") }}).
2. **Early Feature Detection:** A lightweight JavaScript check in `<head>` that detects native switch support before page render to avoid layout shifts.
3. **Polyfill Fallback:** A concise CSS stylesheet using `appearance: none` to render a visual toggle switch in browsers lacking native support.

## Markup

Add the boolean `switch` attribute to a standard checkbox input:

```html
<label class="switch">
  Enable notifications
  <input
    class="switch__control"
    id="notifications"
    type="checkbox"
    switch
  >
</label>
```

When checked, the input submits its standard checkbox value. Read `.checked` (not `.value`) in JavaScript event listeners.

## Feature Detection

Because CSS cannot detect form control rendering support, perform feature detection via JavaScript.

Run a lightweight script inline in the document `<head>` to detect native support and set a helper class (`no-native-switch`) on the root element before the initial paint:

```html
<script>
  if (!('switch' in HTMLInputElement.prototype)) {
    document.documentElement.classList.add('no-native-switch');
  }
</script>
```

## Native Styling (WebKit / Safari)

When native switch support is present, customize the control's highlight color using `accent-color` (see {{ GUIDE_REF("brand-consistent-forms") }}) and ensure visible focus styling:

```css
input[type="checkbox"][switch] {
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

## Polyfill Fallback (Non-WebKit Browsers)

For browsers without native switch rendering (Chrome, Edge, Firefox), style the checkbox directly with `appearance: none` when the `no-native-switch` class is present:

```css
.switch {
  display: inline-flex;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
}

/* Base custom switch track */
html.no-native-switch input[type="checkbox"][switch] {
  appearance: none;
  -webkit-appearance: none;
  inline-size: 3rem;
  block-size: 1.75rem;
  border-radius: 999px;
  background-color: var(--track-off, #e5e5e5);
  border: 2px solid var(--border-color, #808080);
  position: relative;
  margin: 0;
  cursor: pointer;
  outline-offset: 4px;
  transition: background-color 150ms ease, border-color 150ms ease;
  vertical-align: middle;
}

/* Sliding switch thumb */
html.no-native-switch input[type="checkbox"][switch]::before {
  content: "";
  position: absolute;
  inset-block-start: 50%;
  inset-inline-start: 2px;
  inline-size: calc(1.75rem - 8px);
  block-size: calc(1.75rem - 8px);
  border-radius: 50%;
  background-color: Canvas;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transform: translateY(-50%);
  transition: transform 150ms ease;
}

/* Active / Checked track */
html.no-native-switch input[type="checkbox"][switch]:checked {
  background-color: var(--accent-color, #1769e0);
  border-color: var(--accent-color, #1769e0);
}

/* Active / Checked thumb slide */
html.no-native-switch input[type="checkbox"][switch]:checked::before {
  transform: translate(calc(3rem - 1.75rem), -50%);
}

@media (prefers-reduced-motion: reduce) {
  html.no-native-switch input[type="checkbox"][switch],
  html.no-native-switch input[type="checkbox"][switch]::before {
    transition: none;
  }
}
```

## State and Event Handling

Listen to standard `change` events on the input:

```js
const toggle = document.querySelector('#notifications');

toggle.addEventListener('change', () => {
  console.log('Switch state:', toggle.checked);
});
```

## Fallbacks & Browser Support

{{ FEATURE_FALLBACKS("switch-control") }}

{{ FEATURE_FALLBACKS("accent-color") }}
