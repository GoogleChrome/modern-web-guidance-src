---
name: button-group
description: "Build a button group: a set of options (mutually exclusive or not) laid out horizontally and presented as visually connected buttons."
web-feature-ids:
  - customizable-select
---

# Button group

Button groups (sometimes called segment controls or toggle buttons) are common UI patterns for selecting a single option from a small set, such as choosing a layout view or a text alignment. Traditionally, these were built using complex radio button hacks or entirely custom JavaScript components, which often introduced accessibility gaps.

By using the `appearance: base-select` feature, you can transform a standard `<select>` element into a fully customizable button group while retaining all the native accessibility and form integration of a standard select.

## Key Implementation Details

To create a button group, you need to use `appearance: base-select` and then style the internal `option` elements. Opt in to "listbox" behavior with a `size` attribute greater than 1, or a `multiple` attribute.

### 1. Basic Structure

Add a `size` attribute with any value greater than 1 to a `<select>` element to display it as a listbox. When `appearance: base-select` is applied, the browser allows you to style the contents of the select.

```html
<div class="button-group">
  <label for="view-select">Choose View:</label>
  <select id="view-select" size="4" name="view">
    <!-- Wrap the <option> elements in a wrapper for styling. -->
    <div class="wrapper">
      <option value="grid" selected>Grid</option>
      <option value="feed">Feed</option>
      <option value="stack">Stack</option>
      <option value="list">List</option>
    </div>
  </select>
</div>
```

### 2. Styling with CSS

Using CSS Cascade Layers helps organize your styles. Disable the default browser styling on a `select` with `appearance: base-select` and apply your own.

```css
@layer component {
  select {
    appearance: base-select;
    border: none;
    background: transparent;
    padding: 0;
  }

  option {
    appearance: none;
  }

  option::checkmark {
    display: none;
  }

  .wrapper {
    display: flex;
    background: #eee;
    padding: 4px;
    border-radius: calc(var(--button-radius) + 4px);
    inline-size: max-content;
  }

  option {
    padding: 0.6rem 1.2rem;
    border: 1px solid var(--brand-blue);
    border-inline-end-width: 0;
    background: white;
    color: var(--brand-blue);
    text-align: center;
    font-weight: 500;
  }

  option:first-of-type {
    border-radius: var(--button-radius) 0 0 var(--button-radius);
  }

  option:last-of-type {
    border-radius: 0 var(--button-radius) var(--button-radius) 0;
    border-inline-end-width: 1px;
  }
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
option:hover {
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

### 4. Enhancing with JavaScript

In left-to-right, top-to-bottom writing modes, selects handle Up Arrow and Down Arrow keystrokes, but do not handle Left Arrow and Right Arrow keystrokes. Because the button group is horizontal, users will expect to be able to use the Left and Right Arrow keys to change the focus in the same way as the Up and Down arrows. Use JavaScript to manage this behavior.

```js
const selects = document.querySelectorAll("select");

selects.forEach((select) => {
  select.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const options = select.options;
      const focused = [...options].findIndex(
        (option) => option === document.activeElement,
      );
      const nextIndex =
        event.key === "ArrowLeft"
          ? Math.max(0, focused - 1)
          : Math.min(options.length - 1, focused + 1);
      options[nextIndex].focus();
    }
  });
});
```

## Accessibility Benefits

Using a `<select>` for a button group provides several out-of-the-box advantages:

1.  **Form Integration**: Works automatically with `<form>` submission and the `FormData` API.
2.  **Keyboard Navigation**: Supports standard arrow key navigation and "type-to-select" functionality.
3.  **Screen Reader Support**: Announces the role and state correctly without requiring custom ARIA attributes (though `aria-describedby` remains useful for multi-select instructions).

## Multi-Select Button Groups

For multi-selection (like text formatting), add the `multiple` attribute to the `<select>`. With `appearance: base-select`, users can toggle multiple options without holding modifier keys.

```html
<div class="button-group multiple">
  <label for="format-select">Text Formatting</label>
  <select id="format-select" multiple name="format" aria-describedby="multi-hint">
    <div class="wrapper">
      <option value="bold">Bold</option>
      <option value="italic">Italic</option>
      <option value="underline">Underline</option>
    </div>
  </select>
</div>
<span id="multi-hint">Multiple selection allowed.</span>
```

### Fallbacks

{{ FEATURE_FALLBACKS("customizable-select") }}

The most robust fallback for a button group is a set of standard `<button>` elements. By wrapping both the `<select>` and the fallback buttons in a `.button-group` container, you can use `@supports` in CSS to show only the appropriate version.

```html
<div class="button-group">
  <label for="view-select" id="view-select-label">Choose View:</label>
  <select id="view-select" size="4" name="view">...</select>

  <!-- Fallback buttons for browsers without base-select support -->
  <div class="buttons" role="listbox" aria-labelledby="view-select-label">
    <button role="option" type="button" value="grid" aria-pressed="true">
      Grid
    </button>
    <button role="option" type="button" value="feed">Feed</button>
    <button role="option" type="button" value="stack">Stack</button>
    <button role="option" type="button" value="list">List</button>
  </div>
</div>
```

In your CSS, use `@supports` to toggle visibility and to share styles where appropriate:

```css

.button-group select { display: none; }

@supports (appearance: base-select) {
  .button-group select { display: block; }
  .button-group .buttons { display: none; }
}

/* Shared styles for options and buttons */
option, button {
  padding: 0.6rem 1.2rem;
  border: 1px solid var(--brand-blue);
  background: white;
}

option:checked,
button[aria-pressed="true"] {
  background: var(--brand-blue);
  color: white;
}

```

You must also use JavaScript to manage the selection state for the fallback buttons:

```js
const trackButtons = (div) => {
  const buttons = div.querySelectorAll("button");
  const multiple = div.classList.contains("multiple");
  buttons.forEach((button) => {
    button.addEventListener("click", (event) => {
      const isSelected = event.target.ariaPressed === "true";
      if (multiple) {
        event.target.ariaPressed = isSelected ? "false" : "true";
      } else {
        buttons.forEach((btn) => (btn.ariaPressed = btn === event.target));
      }
    });
  });
};

if (!CSS.supports("appearance: base-select")) {
  document.querySelectorAll(".buttons").forEach(trackButtons);
}
```