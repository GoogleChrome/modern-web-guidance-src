---
name: custom-select-picker-layouts
description: Create custom select pickers whose options are positioned in unique or interesting ways, rather than the traditional stacked list of options.
web-feature-ids:
  - customizable-select
sources:
  - https://developer.chrome.com/en/blog/a-customizable-select
  - https://developer.chrome.com/en/blog/new-in-web-ui-io-2025-recap
  - https://developer.chrome.com/en/blog/rfc-customizable-select-findings
  - https://developer.chrome.com/en/blog/rfc-customizable-select
---

# Custom Select Picker Layouts

"Custom Select Picker Layouts" allow developers to break away from the traditional vertical list of options in a `<select>` dropdown. Using `appearance: base-select` and the `::picker(select)` pseudo-element, you can style the options list using modern CSS layout techniques like Grid or Flexbox. This is ideal for color pickers, emoji selectors, or product variants where a visual menu is more effective than a list.

The CSS property `appearance: base-select` unlocks the ability to style the internal parts of a `<select>` element. By targeting `select::picker(select)`, you can apply `display: grid` and position options in columns, creating a rich visual experience without custom JavaScript.

## How to Implement

To implement a custom select picker layout:

1. **Activate Base Styling:** Apply `appearance: base-select` to both the `<select>` element and its internal picker pseudo-element `select::picker(select)`.
2. **Style the Picker Container:** Target `select::picker(select)` and apply `display: grid` (or `display: flex`). Define columns and gaps as you would for any container.
3. **Style Options:** Target the `<option>` elements to style them as grid items or cards. You can add images, SVGs, or complex layouts inside them.
4. **Customize the Trigger (Optional):** Use `<selectedcontent>` inside a `<button>` to render rich content for the selected value.

## Example Code: Custom Grid Picker

```html
<select class="grid-picker">
  <button>
    <!-- Renders the selected value with its rich content -->
    <selectedcontent></selectedcontent>
  </button>
  <option value="sunny">
    <span class="icon">☀️</span>
    <span class="label">Sunny</span>
  </option>
  <option value="cloudy">
    <span class="icon">☁️</span>
    <span class="label">Cloudy</span>
  </option>
  <!-- More options... -->
</select>
```

```css
/* Activate the customizable select state */
.grid-picker,
.grid-picker::picker(select) {
  appearance: base-select;
}

/* Style the dropdown list as a grid */
.grid-picker::picker(select) {
  display: grid;
  grid-template-columns: repeat(2, 1fr); /* 2 columns */
  gap: 10px;
  padding: 15px;
  background: white;
  border: 1px solid #ccc;
  border-radius: 8px;
}

/* Style options as grid cards */
.grid-picker option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 15px;
  border: 1px solid #eee;
  border-radius: 6px;
}

.grid-picker option:checked {
  border-color: #007bff;
  background-color: #f0f7ff;
}
```

## Strategic Implementation & Best Practices

- **DO** use `appearance: base-select` when you need to change the visual layout of options from a standard list to a 2D grid or custom flex flow.
- **DO NOT** assume the styles apply to all browsers equally yet; verify support and provide a fallback.
- **DO NOT** confuse visual layout with keyboard navigation. Standard select uses linear navigation. If you arrange options in a grid, ensure visual order matches DOM order so tab/arrow navigation makes sense.
- **DO** use `<selectedcontent>` if you want the trigger button to show images or icons from the selected option automatically.
- **DO** use standard `value` attributes on options to ensure form submission works exactly as before.

## Fallback Strategy

For browsers that do not yet support `appearance: base-select`, the select will degrade gracefully to a standard OS select dropdown. The grid styles will be ignored, but the select will remain functional.

If the grid layout is critical and must be preserved, use a feature detection check and a JavaScript fallback (or use a framework component).

```javascript
document.addEventListener("DOMContentLoaded", () => {
  if (!CSS.supports("appearance", "base-select")) {
    console.log("Custom select layout not supported. Falling back to native UI.");
    // No action needed for standard select fallback, it just works!
    // Or you can initialize a JS-based custom dropdown here if critical.
  }
});
```
