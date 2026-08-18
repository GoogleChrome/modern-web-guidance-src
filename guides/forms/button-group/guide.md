---
name: button-group
description: "Build a button group: a set of options (mutually exclusive or not) laid out horizontally and presented as visually connected buttons."
web-feature-ids:
  - customizable-select
---

Button groups (sometimes called segment controls or toggle buttons) are common UI patterns for selecting a single option from a small set, such as choosing a layout view or a text alignment. Traditionally, these were built using complex radio button hacks or entirely custom JavaScript components, which often introduced accessibility gaps.

By using the `appearance: base-select` feature, you can transform a standard `<select>` element into a fully customizable button group while retaining all the native accessibility and form integration of a standard select.

## Key Implementation Details

To create a button group, you need to use `appearance: base-select` and then style the internal `option` elements. Opt in to "listbox" behavior with a `size` attribute greater than 1, or a `multiple` attribute.

### 1. Basic Structure

Add a `size` attribute with any value greater than 1 to a `<select>` element to display it as a listbox. When `appearance: base-select` is applied, the browser allows you to style the contents of the select, and add additional elements to aid in styling.

```html
<label for="view-select">Choose View:</label>
<select id="view-select" size="4" name="view">
  <!-- Wrap the <option> elements in a wrapper for styling. -->
  <div class="wrapper">
    <option value="grid">Grid</option>
    <option value="feed">Feed</option>
    <option value="stack">Stack</option>
    <option value="list">List</option>
  </div>
</select>
```

### 2. Styling with CSS

Disable the default browser styling on a `select` with `appearance: base-select` and apply your own. Using CSS variables ensures consistency across your UI.

```css

select {
  appearance: base-select;
  border: none;
  background: transparent;
}

.wrapper {
  display: flex; /* Arrange options horizontally */
  background: #eee;
  padding: 4px;
  border-radius: calc(var(--button-radius) + 4px);
  width: max-content;
}

option {
  appearance: none; /* Remove default checkmark/styling */
  padding: 0.6rem 1.2rem;
  background: white;
  color: var(--brand-blue);
  border: 1px solid var(--brand-blue);
  border-inline-end-width: 0;
  transition: all 0.2s ease;
  text-align: center;
}

/* Connected button look: round only outer corners */
option:first-of-type {
  border-radius: var(--button-radius) 0 0 var(--button-radius);
}

option:last-of-type {
  border-radius: 0 var(--button-radius) var(--button-radius) 0;
  border-inline-end-width: 1px;
}

/* Hide the default checkmark since we use button styling */
option::checkmark {
  display: none;
}
```

### 3. Handling States

Since you are using a real `<select>`, you can use standard CSS pseudo-classes to style the selected and focus states.

```css
/* Selected state */
option:checked {
  background: var(--brand-blue);
  color: white;
}

/* Hover state */
option:hover:not(:checked) {
  background: var(--brand-hover);
  color: #004494;
  text-decoration: underline;
}

/* Keyboard focus */
option:focus-visible {
  outline: 3px solid var(--focus-gold);
  outline-offset: -3px;
}
```

## Accessibility Benefits

Using a `<select>` for a button group provides several out-of-the-box advantages:

1.  **Form Integration**: Works automatically with `<form>` submission and the `FormData` API.
2.  **Keyboard Navigation**: Supports standard arrow key navigation and "type-to-select" functionality.
3.  **Screen Reader Support**: Announces the role and state correctly without requiring custom ARIA attributes (though `aria-describedby` remains useful for multi-select instructions).

## Multi-Select Button Groups

For multi-selection (like text formatting bold/italic/underline), add the `multiple` attribute rather than the `size` attribute. 

With `appearance: base-select` applied to a `<select>` element, users don't have to hold a modifier key (`Cmd` or `Ctrl`) to select multiple options.

```html
<select id="format-select" multiple aria-describedby="multi-hint">
  <div class="wrapper">
    <!-- options here -->
  </div>
</select>
<span id="multi-hint">Multiple selection allowed.</span>
```

### Fallbacks

{{ FEATURE_FALLBACKS("customizable-select") }}
