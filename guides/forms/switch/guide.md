---
name: switch
description: Build a modern, accessible switch component that allows users to toggle between two states using the native HTML switch attribute and standard accent-color.
web-feature-ids:
  - switch-control
  - accent-color
---

# Build Accessible, Native Switch Controls

Switch components allow users to toggle instantly between two binary states (e.g., enabling dark mode, turning settings on or off). Historically, creating custom switches required complex HTML `div` structures, fragile CSS sliding transitions, and custom accessibility attributes like `role="switch"` and `aria-checked`.

The standardized HTML `switch` attribute natively transforms a checkbox into a fully interactive, touch-friendly, and gesture-capable switch control. By combining the `switch` attribute with the standard `accent-color` property, you can build a modern switch that inherits browser-native gesture behaviors and remains 100% accessible to keyboard and screen-reader users out-of-the-box.

---

## Implementation steps

1.  **Declare the Checkbox Control**: Use a standard `<input type="checkbox">` as the semantic foundation for your switch toggle.
2.  **Apply the Switch Attribute**: Add the standard `switch` attribute directly to the checkbox `<input>` element: `<input type="checkbox" switch>`. This opts-in to the browser's native switch rendering and gesture mechanics.
3.  **Establish Accessible Labeling**: Nest the switch control inside a `<label>` element or link it using explicit `id` and `for` attributes. This ensures assistive technologies correctly map the switch toggle's description.
4.  **Style with Accent Color**: Use the standard `accent-color` CSS property on the checkbox to style its active/track state to match your design tokens.
5.  **Ensure Focus-Visible Contrast**: Define custom `:focus-visible` outline styles to provide keyboard navigation users with a distinct, high-contrast visual indicator when the switch is focused.
6.  **Trigger Actions via Event Listeners**: Bind standard `change` event listeners to the input to handle state mutations immediately, and leverage native attributes like `checked` to query or restore the state.

---

## Example: User Preference Switch Toggle

This pattern creates a clean, semantic, and highly custom-branded switch control that updates and persists user preference settings.

### HTML Structure: Option A (Explicit Separated Pattern)
This is the recommended approach for custom layout styling, as it separates the label from the input while explicitly linking them.

```html
<div class="preference-field">
  <label class="preference-description" for="dark-mode">
    <strong>Dark mode</strong>
    <span>Use darker colours throughout the page.</span>
  </label>

  <!-- REQUIRED: Use type="checkbox" with the standard "switch" attribute -->
  <input
    id="dark-mode"
    type="checkbox"
    switch
  >
</div>
```

### HTML Structure: Option B (Implicit Nested Pattern)
This approach implicitly associates the label and input by nesting, which can simplify markup and provide direct event scoping without requiring strict ID management.

```html
<label class="preference-field">
  <span class="preference-description">
    <strong>Dark mode</strong>
    <span>Use darker colours throughout the page.</span>
  </span>

  <!-- REQUIRED: Use type="checkbox" with the standard "switch" attribute -->
  <input
    id="dark-mode"
    type="checkbox"
    switch
  >
</label>
```

### CSS Style Rules
```css
/* Container layout for alignment */
.preference-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
}

/* Base switch input styling */
input[type="checkbox"][switch] {
  flex: 0 0 auto;
  inline-size: 3rem;
  block-size: 1.75rem;
  cursor: pointer;
  
  /* REQUIRED: Customizes the native active/track color */
  accent-color: var(--accent-color, #1769e0);
}

/* MANDATORY Copy-Paste Safety: Clear focus-visible styling for keyboard users */
input[type="checkbox"][switch]:focus-visible {
  outline: 3px solid var(--focus-color, #ff8c00);
  outline-offset: 4px;
}
```

### JavaScript Preferences Engine
```javascript
const root = document.documentElement;
const darkModeToggle = document.getElementById('dark-mode');

// Sync and apply preferences immediately
darkModeToggle.addEventListener('change', (e) => {
  const isEnabled = e.target.checked;
  
  // Apply change immediately to the DOM
  root.dataset.theme = isEnabled ? 'dark' : 'light';
  
  // Save preference
  localStorage.setItem('preference-dark-mode', isEnabled);
});

// Restore preference on load
const savedPref = localStorage.getItem('preference-dark-mode');
if (savedPref !== null) {
  darkModeToggle.checked = savedPref === 'true';
}
```

---

## Key constraints

*   **Limited Shadow DOM Customizability**: Because `<input type="checkbox" switch>` uses native shadow DOM rendering, deep visual customizations (like modifying the exact shape or position of the internal slider thumb) are limited. For basic branding, `accent-color` is the recommended property.
*   **Checkbox Form Semantics**: The control behaves semantically as a checkbox. When submitting forms, a checked switch sends its value as standard checkbox data (e.g., `on`).

---

## Fallback strategies

{{ FEATURE_FALLBACKS("switch-control") }}

The standard HTML `switch` attribute is designed with progressive enhancement at its core.

*   **Graceful Degradation**: In browsers that do not yet support the `switch` attribute, the element automatically degrades to a standard, fully functional HTML `<input type="checkbox">`. It retains all semantic value, accessibility mappings, and keyboard and form-submission behaviors out-of-the-box.
*   **Standard Checkbox Fallback**: For most projects, allowing the standard checkbox fallback is the recommended and cleanest approach. It guarantees 100% usability and accessibility across all historical browser versions.
