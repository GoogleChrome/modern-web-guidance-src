---
description: Create customizable select menus with web-native styling for richer user experiences.
filename: customizable-select-menus
category: ui
---

# Customizable Select Menus

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/HTML/Element/select#customization
- https://chromestatus.com/feature/5120638407409664

## Best Practices

Leverage the new `appearance: base-select;` property and `::picker(select)` pseudo-element to enable web-native styling of `<select>` elements. This allows for fine-grained control over the display of options and the selected content, including the ability to hide elements like icons and subtitles in the closed state using `display: none` within `<selectedcontent>`.

```css
.custom-select {
  appearance: base-select;
}

.custom-select::picker(select) {
  /* Style the dropdown list of options */
}

.custom-select <selectedcontent> {
  /* Style the content of the selected option */
}

.custom-select::picker-icon {
  /* Style the dropdown arrow icon */
}

.custom-select option:checked ~ .checkmark {
  /* Style the checkmark indicator */
}
```

## Fallback strategies

If the user's Baseline target (or Widely available, if unavailable) does not support any of the required features, the following fallback strategies MUST be used.

### Customizable Select Menus

- **DO** use `@supports (appearance: base-select)` for CSS feature detection.
- **DO NOT** attempt to polyfill this feature as it requires significant browser-level changes. Instead, rely on progressive enhancement, ensuring that browsers not supporting these features will still render a functional, albeit unstyled, native select element.