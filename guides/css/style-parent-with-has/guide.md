---
name: style-parent-with-has
description: Style parent elements of a form field (e.g. labels or fieldsets) when the field is invalid.
web-feature-ids:
  - user-pseudos
---

# Style Parent with :has()

## The Problem
Often, an error state requires styling elements *outside* the input itself—for example, changing the color of a parent `fieldset` border, highlighting the `<label>`, or showing a global error icon in the card header. Historically, this required JavaScript to toggle classes on parent elements.

## The Solution
By combining `:has()` with `:user-invalid`, we can declaratively style any ancestor based on the validity state of a specific descendant. This keeps all presentation logic in CSS.

### Implementation Strategy

1.  **Selector**: Use `.parent:has(:user-invalid)` to target the container.
2.  **Scope**: Be specific to avoid performance issues. Target `.field-group` rather than `body`.
3.  **Fallback**: Requires JS to toggle classes on the parent if `:has()` is not supported.

## Implementation Guide

### 1. HTML Structure
```html
<form>
  <div class="card-section">
    <div class="header">
      <h3>Profile Settings</h3>
      <span class="status-icon"></span>
    </div>

    <div class="field">
      <label for="username">Username</label>
      <input type="text" id="username" required>
    </div>
  </div>
</form>
```

### 2. CSS
```css
/* Default State */
.card-section {
  border: 1px solid #ccc;
  border-left: 4px solid #ccc;
}

/*
  Parent Styling Logic:
  If the card contains ANY user-invalid input, turn the whole card's edge red.
*/
.card-section:has(:user-invalid) {
  border-left-color: #d93025;
  background-color: #fff8f8;
}

/* Change the icon too */
.card-section:has(:user-invalid) .status-icon::after {
  content: "⚠️";
}
```

## Fallbacking & Browser Support

The `:user-invalid` pseudo-class is widely supported (Baseline 2023), but if you need to support older browsers, you must ensure consistency of the implementation.

### CSS for Fallback
We use a class `.has-error` on the parent to mimic the `:has()` behavior.

```css
/* Native */
.card-section:has(:user-invalid) {
  border-left-color: #d93025;
}

/* Fallback */
.card-section.has-error-fallback {
  border-left-color: #d93025;
}
```

### JavaScript Fallback

{{ FEATURE("user-pseudos", "javascript-fallback")}}

```js
// 1. Initialize the generic fallback
const form = document.querySelector('#demo-form');
UserInvalidFallback.init(form);

// 2. Add specialized "parent styling" logic (Separate from fallback)
// Listen for changes to form validity after interaction
form.addEventListener('blur', (e) => {
  if (!e.target.matches('input, select, textarea')) return;

  // Find the container we want to style (sync with CSS)
  const container = e.target.closest('.card-section');
  if (!container) return;

  // Check if ANY fallbacked input in this container is invalid
  const hasError = container.querySelector('.user-invalid-fallback');
  container.classList.toggle('has-error-fallback', !!hasError);
}, true); // Capture phase to ensure we run after the fallback's blur listener

// Also handle input events for immediate cleanup
form.addEventListener('input', (e) => {
  const container = e.target.closest('.card-section');
  if (container) {
    const hasError = container.querySelector('.user-invalid-fallback');
    container.classList.toggle('has-error-fallback', !!hasError);
  }
});

// Handle form resets
form.addEventListener('reset', () => {
  form.querySelectorAll('.has-error-fallback').forEach(el => {
    el.classList.remove('has-error-fallback');
  });
});
```

## Other Considerations

1.  **Accessibility**: {{ FEATURE("user-pseudos", "aria-invalid") }}
