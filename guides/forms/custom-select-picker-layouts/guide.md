---
name: custom-select-picker-layouts
description: Create custom select pickers whose options are positioned in unique or interesting ways, rather than the traditional stacked list of options.
web-feature-ids:
  - customizable-select
---

# Custom Select Picker Layouts

The CSS property `appearance: base-select` unlocks the ability to style a `<select>` element and its picker (via `::picker(select)`) like regular HTML elements.
Combined with modern CSS layout techniques like Grid or Flexbox, you can break away from the traditional stacked vertical list and create a rich visual experience without custom JS.
For example, you can use `display: grid` to style the options as a 2D grid of cards.

This is ideal for color pickers, emoji selectors, or product variants where a rich visual menu is more effective than a list.

## How to Implement

### 1. Activate Base Styling

Apply `appearance: base-select` to both the `<select>` element and its internal picker pseudo-element `select::picker(select)`:

```css
select.grid-picker {
  &, &::picker(select) {
    appearance: base-select;
  }
}

```

### 2. Style the Picker Container

Target `select:open::picker(select)` and apply `display: grid` (or `display: flex`).
Define columns and gaps as you would for any container.

```css
select.grid-picker:open::picker(select) {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}
```

IMPORTANT: The `:open` is necessary. If you style `select::picker(select)`, it will make the picker visible even when the select is closed!

### 3. Style the Options

Target the `<option>` elements to style them as grid items or cards.
You can add images, SVGs, or complex layouts inside them.

```css
/* Style options as grid cards */
.grid-picker option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* padding, border-radius, background, etc. */
}
```

### 4. Style the selected option

To style the selected *option*, use `option:checked`. For example:

```css
.grid-picker option:checked {
  position: relative;
  border: 2px solid var(--primary-color);
  background-color: oklab(from var(--primary-color) l a b / 8%);
}
```

As with any UI control, do not communicate state with color alone, and use multiple visual indicators (e.g. colors, border thickness, checkmark) to communicate which option is selected.

### 5. (Optional) Style the selected option checkmark

By default, the browser renders a checkmark as the first child of every `<option>`.

It behaves like a `::before` with `content: "✓" / ""`, rendered before an author-provided `::before`, if one exists.

If the option is not selected, the checkmark is hidden via `visibility: hidden`.

You can style it using the `::checkmark` pseudo-element, or hide it entirely if you want to convey selection via styling alone or use a custom indicator.

For example, to place it at the top-right corner of the option, you could do something like:

```css
select.grid-picker {
  > option::checkmark {
    /* Hide the checkmark for unselected options */
    display: none;
  }

  > option:checked {
    position: relative;

    &::checkmark {
      position: absolute;
      inset-block-start: -.4em;
      inset-inline-end: -.5em;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      min-inline-size: 1.6em;
      aspect-ratio: 1;
      padding-right: 0.12em;
      padding-left: 0.05em;
      border-radius: 50%;
      background: var(--primary-color);
      color: white;
      font-size: 70%;
      font-weight: bold;
    }
  }
}
```

**Tip:** When painting a container (e.g. a circle) around the checkmark, nudge it a little towards the top (as we did here with `padding-bottom` and `padding-left`) for optical centering that accounts for its shape.
Do NOT use `padding-inline-start` or `padding-block-end` for this, as they will change depending on writing mode, whereas the shape of the checkmark does not.

### 6. (Optional) Customize the selected option display

By default, the `<select>` will show a text-only version of the selected option.
To display rich content for the selected value, use `<selectedcontent>` inside a `<button>` and/or to display the selected option differently (e.g. hide certain details).

Not **NOT** use `<selectedcontent>` without the `<button>` around it, as the `<selectedcontent>` will just become part of the picker, like any other content element.

### Best practices

{{ FEATURE("customizable-select", "usage") }}

## Accessibility

<!-- NOTE This needs a11y SME review! -->

A native `<select>` only handles linear Up/Down arrow navigation, so Left/Right do nothing in the open picker and Up/Down still navigate items sequentially, regardless of rows and columns.

To implement spatial navigation that follows the grid, you can intercept `keydown` and route focus to the nearest option in the pressed direction (e.g. using `getBoundingClientRect()`).
To determine the appropriate next/previous item, use DOM methods that operate on actual geometry (e.g. `getBoundingClientRect()`) rather than parsing CSS strings like `grid-template-columns` or `grid-column`, which can be brittle and error-prone for complex grids, subgrid, RTL, and other layout scenarios.


## Fallback Strategy

{{ FEATURE_FALLBACKS("customizable-select") }}
