---
name: switch
description: Build an accessible switch with the native HTML switch attribute, falling back to a styled checkbox when not supported.
web-feature-ids:
  - switch-control
  - accent-color
---

# Build Accessible Switch Controls

Use the HTML `switch` attribute on `<input type="checkbox" role="switch" switch>` with an associated `<label>` to build a binary on/off toggle that preserves native form submission, keyboard navigation, and screen reader semantics (see {{ GUIDE_REF("checkbox") }} and {{ GUIDE_REF("forms") }}).

## Markup

Add the boolean `switch` attribute and `role="switch"` to a standard checkbox input:

```html
<label>
  Enable notifications
  <input id="notifications" type="checkbox" role="switch" switch>
</label>
```

- The label can wrap the input or be associated with `for`/`id`. All styling targets the input, so it doesn't depend on the label structure.
- When checked, the input submits its standard checkbox value. In JavaScript, listen for `change` (or `input`) events and read `.checked` rather than `.value`.

## Feature Detection

CSS cannot detect support for the `switch` attribute, so detect it with an inline script in `<head>`. Assume native support by default, adding the `no-native-switch` class to the root element only when unsupported to avoid a flash of unstyled content before first paint:

```html
<script>
  document.documentElement.classList.toggle(
    'no-native-switch',
    !('switch' in HTMLInputElement.prototype)
  );
</script>
```

## Native Styling

Style the native switch by default when `.no-native-switch` is absent. Customize the control's highlight color using `accent-color` (see {{ GUIDE_REF("brand-consistent-forms") }}) and ensure visible focus styling:

```css
html:where(:not(.no-native-switch)) input[type="checkbox"][switch] {
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

Always conditionally load the polyfill only when native support is missing. Do not load the polyfill unconditionally.

For browsers without native switch support, dynamically import `input-switch-polyfill`. It progressively enhances checkboxes with the `switch` attribute by applying switch styling, managing states, and providing pointer drag support.

Combine feature detection with dynamic import in `<head>`:

**Option 1: Using a bundler**

Install the polyfill via npm (`npm install input-switch-polyfill`). Conditionally import it in your application entry or head script:

```javascript
if (!('switch' in HTMLInputElement.prototype)) {
  document.documentElement.classList.add('no-native-switch');
  import('input-switch-polyfill');
}
```

**Option 2: Using a CDN**

For standalone setups without a build pipeline, conditionally import from a CDN:

```html
<script>
  if (!('switch' in HTMLInputElement.prototype)) {
    document.documentElement.classList.add('no-native-switch');
    import('https://unpkg.com/input-switch-polyfill');
  }
</script>
```

## Fallbacks & Browser Support

{{ BASELINE_STATUS("switch-control") }}

{{ BASELINE_STATUS("accent-color") }}
