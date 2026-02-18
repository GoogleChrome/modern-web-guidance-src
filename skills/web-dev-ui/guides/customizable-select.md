---
description: Create fully customizable, accessible select elements using appearance: base-select
web-feature-ids:
  - appearance
  - base-select
  - popover
  - anchor-positioning
---

# Customizable Select

Reference docs:

- https://developer.mozilla.org/en-US/docs/Web/CSS/appearance
- https://open-ui.org/components/select.research/
- https://chrome.developers.google.com/blog/customizable-select

## Best Practices

Use **semantic HTML** and the `appearance: base-select` property to opt-in to customizable rendering. This ensures you maintain the accessibility keywords, focus management, and form behavior of a native control while gaining full styling control.

```css
select {
  appearance: base-select;
}

/* Custom button styles */
select > button {
  appearance: none;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  display: flex;
  justify-content: space-between;
}

/* Custom dropdown styles */
select::picker(select) {
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  background: white;
  padding: 0.5rem;
}
```

**DO** use `<selectedcontent>` inside your custom button to automatically reflect the selected option.
**DO NOT** restrict the `select` width unnecessarily; let it adapt to content or layout.

## Baseline Status

Baseline: Limited availability (Experimental)

- **Status**: Limited availability (Experimental).
- **Documentation**: [Web Platform Status](https://webstatus.dev/features/customizable-select?q=customizable+select)
- **Availability**: Not yet widely available across all browsers.
- **Caveats**: Requires `--experimental-web-platform-features` flag in some browsers or specific versions. See [Can I Use](https://caniuse.com/mdn-css_properties_appearance_base-select) for details.

## Fallback strategies

If the user's browser does not support `appearance: base-select`, the following fallback strategies MUST be used.

### Feature Detection & Progressive Enhancement

- **DO** use `@supports (appearance: base-select)` for feature detection.

* **DO** start with a functional native select.
* **DO** ensure that extra elements like `<button>` inside `<select>` do not break rendering in older browsers (they are typically ignored).

```css
/* Default / Fallback */
select {
  font-size: 1rem;
  padding: 0.5rem;
}

/* Modern */
@supports (appearance: base-select) {
  select {
    appearance: base-select;
    border: none;
    padding: 0;
  }
}
```

## Advanced Customization

### Rich Content Options

You can include images, detailed text, and flexible layouts inside `<option>` elements.

```html
<option value="user1">
  <img src="avatar.jpg" alt="" class="avatar" />
  <div class="info">
    <div class="name">Jane Doe</div>
    <div class="email">jane@example.com</div>
  </div>
</option>
```

### Custom Arrow

Use your own SVG for the dropdown arrow within the custom button.

```html
<button>
  <selectedcontent></selectedcontent>
  <svg class="chevron">...</svg>
</button>
```

```css
select:open .chevron {
  transform: rotate(180deg);
}
```
