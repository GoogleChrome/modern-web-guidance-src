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
3. **Polyfill Fallback:** A concise CSS stylesheet that uses the existing checkbox for semantics and the associated label's pseudo-elements for a visual toggle switch in browsers lacking native support.

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

Because CSS cannot detect form control rendering support, perform feature detection via JavaScript. API exposure alone is not proof that the browser renders a native switch, so use the rendering probe below and keep the fallback when native rendering cannot be confirmed. Add the pending class before probing to prevent a flash of the wrong control:

```html
<script>
  const root = document.documentElement;
  root.classList.add('switch-detection-pending');

  function supportsNativeSwitchRendering() {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText =
      'position:absolute;inline-size:0;block-size:0;border:0;visibility:hidden;';
    root.append(frame);

    try {
      const frameDocument = frame.contentDocument;
      frameDocument.body.innerHTML = `
        <input id="checkbox" type="checkbox">
        <input id="switch" type="checkbox" switch>
      `;

      const checkbox = frameDocument.querySelector('#checkbox');
      const switchControl = frameDocument.querySelector('#switch');

      return switchControl.offsetWidth !== checkbox.offsetWidth ||
        switchControl.offsetHeight !== checkbox.offsetHeight;
    } finally {
      frame.remove();
    }
  }

  const supportsNativeSwitch = supportsNativeSwitchRendering();

  root.classList.toggle('native-switch', supportsNativeSwitch);
  root.classList.toggle('no-native-switch', !supportsNativeSwitch);
  root.classList.remove('switch-detection-pending');
</script>
```

## Native Styling (WebKit / Safari)

When native switch support is confirmed, customize the control's highlight color using `accent-color` (see {{ GUIDE_REF("brand-consistent-forms") }}) and ensure visible focus styling:

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

## Polyfill Fallback (Non-WebKit Browsers)

Keep the controls hidden while the implementation class is being selected:

```css
html.switch-detection-pending input[type="checkbox"][switch],
html.switch-detection-pending .switch::before,
html.switch-detection-pending .switch::after {
  visibility: hidden;
}
```


For browsers without native switch rendering (Chrome, Edge, Firefox), use the existing checkbox for semantics and interaction, and use the associated label's pseudo-elements for the visual switch when the `no-native-switch` class is present. Do not rely on pseudo-elements on the checkbox itself; form controls are replaced elements and support is inconsistent.

```css
.switch {
  --switch-block-size: 1.75rem;
  --switch-inline-size: 3rem;
  --switch-border-size: 2px;
  --switch-thumb-size: calc(
    var(--switch-block-size) - (2 * var(--switch-border-size))
  );

  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 1rem;
  padding-inline-end: var(--switch-inline-size);
  cursor: pointer;
}

/* Keep the checkbox as the semantic and interactive control. */
html.no-native-switch .switch__control {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* The label pseudo-elements provide the fallback track and thumb. */
html.no-native-switch .switch::before {
  position: absolute;
  inset-block-start: 50%;
  inset-inline-end: 0;
  inline-size: var(--switch-inline-size);
  block-size: var(--switch-block-size);
  box-sizing: border-box;
  border: var(--switch-border-size) solid var(--border-color, #808080);
  border-radius: 999em;
  background-color: var(--track-off, #e5e5e5);
  content: "";
  transition: background-color 150ms ease, border-color 150ms ease;
  margin-block-start: calc(var(--switch-block-size) / -2);
}

html.no-native-switch .switch::after {
  position: absolute;
  inset-block-start: 50%;
  inset-inline-end: calc(
    var(--switch-inline-size) - var(--switch-border-size) - var(--switch-thumb-size)
  );
  inline-size: var(--switch-thumb-size);
  block-size: var(--switch-thumb-size);
  box-sizing: border-box;
  border: var(--switch-border-size) solid var(--border-color, #808080);
  border-radius: 50%;
  background-color: Canvas;
  box-shadow: 0 1px 3px rgb(0 0 0 / 25%);
  content: "";
  transition: inset-inline-end 150ms ease, border-color 150ms ease;
  margin-block-start: calc(var(--switch-thumb-size) / -2);
}

html.no-native-switch .switch:has(.switch__control:checked)::before {
  background-color: var(--accent-color, #1769e0);
  border-color: var(--accent-color, #1769e0);
}

html.no-native-switch .switch:has(.switch__control:checked)::after {
  inset-inline-end: var(--switch-border-size);
  border-color: var(--accent-color, #1769e0);
}

html.no-native-switch .switch:focus-within {
  outline: 3px solid var(--focus-color, #ff8c00);
  outline-offset: 4px;
}

@media (prefers-reduced-motion: reduce) {
  html.no-native-switch .switch::before,
  html.no-native-switch .switch::after {
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
