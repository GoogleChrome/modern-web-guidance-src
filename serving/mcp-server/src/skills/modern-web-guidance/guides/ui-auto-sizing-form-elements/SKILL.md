---
description: Automatically size form elements based on their content with CSS field-sizing.
filename: auto-sizing-form-elements
category: ui
---

# Auto-sizing form elements

CSS `field-sizing` provides a simple, one-line solution to automatically adjust the size of form elements to fit their content, eliminating the need for JavaScript-based solutions.

## Best Practices

Apply `field-sizing: content;` to `textarea`, `select`, and `input` elements to enable content-based sizing.

```css
textarea,
select,
input {
  field-sizing: content;
}
```

This CSS property allows elements like textareas, selects, and various input types to dynamically resize based on the text they contain or the selected option.

### Element-specific behavior

*   **`<textarea>`**: Collapses to fit the placeholder or `min-inline-size` and grows as the user types, wrapping text and increasing height when necessary.
*   **`<select>`**: Shrinks to fit the selected option. A multi-select element grows to fit the widest option and the required height for all options.
*   **`<input type="text">`, `<input type="email">`, `<input type="number">`**: Collapses to fit the placeholder or `min-inline-size` and grows inline until `max-inline-size` is reached, at which point overflow clips the value.
*   **`<input type="file">`**: Collapses to fit the button and prefilled filename, expanding to accommodate the filename upon upload.

## Defensive CSS for Empty and Overflowing Content

While `field-sizing` simplifies sizing, it can lead to elements becoming too small or too large. Implementing "defensive CSS" is recommended to prevent undesirable visual states.

```css
textarea {
  min-block-size: 3.5rlh;
  min-inline-size: 20ch;
  max-inline-size: 50ch;
}

select {
  min-inline-size: 5ch;
  min-block-size: 1.5lh;
}

input {
  min-inline-size: 7ch;
}
```

These styles use relative units like `rlh` and `ch` to set minimum and maximum sizes, ensuring a more robust and visually stable user experience.

## Placeholder Impact

When using placeholders, they define the initial intrinsic size of inputs with `field-sizing: content`. Ensure your placeholders are appropriately sized.

## Default Value

The default value for `field-sizing` is `fixed`. The property accepts only two values: `fixed` and `content`.