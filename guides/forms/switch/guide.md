---
name: switch
description: Build an accessible switch with the native HTML switch attribute, falling back to a styled checkbox when not supported.
web-feature-ids:
  - switch-control
  - accent-color
---

# Build Accessible Switch Controls

Use the HTML `switch` attribute on `<input type="checkbox" switch>` with an associated `<label>` to build a binary on/off toggle that preserves native form submission, keyboard navigation, and screen reader semantics (see {{ GUIDE_REF("checkbox") }} and {{ GUIDE_REF("forms") }}).

## Markup

Add the boolean `switch` attribute to a standard checkbox input:

```html
<label>
  Enable notifications
  <input id="notifications" type="checkbox" switch>
</label>
```

- The label can wrap the input or be associated with `for`/`id`. All styling targets the input, so it doesn't depend on the label structure.
- When checked, the input submits its standard checkbox value. In JavaScript, listen for `change` (or `input`) events and read `.checked` rather than `.value`.

## Styling

Customize the control's highlight color using `accent-color` (see {{ GUIDE_REF("brand-consistent-forms") }}) and ensure visible focus styling:

```css
input[type="checkbox"][switch] {
  accent-color: var(--accent-color, #1769e0);
  margin: 0;
  cursor: pointer;
}

input[type="checkbox"][switch]:focus-visible {
  outline: 3px solid var(--focus-color, #ff8c00);
  outline-offset: 4px;
}
```

## Fallback strategies

### Fallbacks & browser support for switch-control

{{ BASELINE_STATUS("switch-control") }}

If your Baseline target does not support `<input type="checkbox" switch>`, load `input-switch-polyfill` only when `'switch' in HTMLInputElement.prototype` is `false`. Do not load the polyfill unconditionally. The polyfill enhances checkboxes with the `switch` attribute by setting `role="switch"`, applying switch styling (`appearance: none`), syncing computed `accent-color`, and providing pointer drag support.

Use the package-loading approach appropriate to your project. The example below assumes your setup can resolve module specifiers:

```javascript
if (!('switch' in HTMLInputElement.prototype)) {
  import('input-switch-polyfill');
}
```

{{ FEATURE_FALLBACKS("accent-color") }}
