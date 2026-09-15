---
name: checkbox
description: Style checkboxes, including custom icons, layout, colors, check/uncheck animations, while preserving native functionality and accessibility.
web-feature-ids:
  - accent-color
  - indeterminate
  - individual-transforms
---

# Styling Checkboxes

Checkboxes are a core interactive element of web forms. Previous attempts to style checkboxes often involved hiding the native `<input>` element entirely and rendering a complex tree of custom wrapper `<div>`s or `<span>`s with ARIA roles. This legacy approach is highly error-prone, which can break native keyboard navigation, affect screen reader announcements, break native form validation, and disrupt standard form submission.

Modern CSS allows you to style checkboxes directly, either by customizing the native appearance using the **`accent-color`** property, or by overriding default presentation entirely using **`appearance: none`** directly on the `<input type="checkbox">` element.


## 1. The Bare-Bones HTML Structure

Always use semantic, accessible HTML. Associate the checkbox with its label by nesting the input inside the `<label>` element, or by using `for`/`id` attributes.

```html
<!-- Nested Label Pattern (Implicit Association) -->
<label>
  <input type="checkbox" name="subscribe" class="checkbox-native" />
  Subscribe to newsletter
</label>

<!-- Explicit Association Pattern -->
<input type="checkbox" id="terms-input" name="terms" class="checkbox-custom" />
<label for="terms-input">I accept the terms and conditions</label>
```


## 2. Implementation

### Method A: Native Customization (`accent-color`)

For quick, brand-consistent styling that preserves 100% of native rendering and operating system focus indicators, use the `accent-color` property. This colors the checkbox background when checked/active, and the browser automatically selects a high-contrast checkmark color.

```css
.checkbox-native {
  accent-color: #1a73e8;
  
  /* Sizing is controlled via relative units */
  width: 1.25em;
  height: 1.25em;
  cursor: pointer;
}
```


### Method B: Fully Custom Styling (`appearance: none`)

To build bespoke checkmark shapes, borders, and animations, use `appearance: none` directly on the `<input>` element. This strips the native browser styling while leaving the `<input>` in the DOM as the interactive target.

You can render a crisp vector checkmark with **CSS masking** on a pseudo-element. This keeps your markup entirely flat and lets you style the checkmark color using `currentColor` (matching the parent's text color).

```css
.checkbox-custom {
  /* Remove default browser visual box */
  appearance: none;
  -webkit-appearance: none; /* Legacy support */
  
  /* Create custom grid layout shell */
  display: inline-grid;
  place-content: center;
  width: 1.25em;
  height: 1.25em;
  border: 2px solid currentColor;
  cursor: pointer;
}

/* Custom Checkmark Icon via ::before */
.checkbox-custom::before {
  content: "";
  width: 0.7em;
  height: 0.7em;
  background-color: currentColor;
  
  /* Render a custom checkmark SVG via CSS mask */
  mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>') no-repeat center / contain;
  
  /* Scale to 0 (hidden) by default to animate check/uncheck */
  scale: 0;
  transition: scale 0.15s ease;
}

/* Animate checked scale */
.checkbox-custom:checked::before {
  scale: 1;
}

/* Disabled State */
.checkbox-custom:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
```


## 3. Styling the Indeterminate State

When a checkbox is programmatically set to `indeterminate = true`, ensure you style the `:indeterminate` pseudo-class to visually indicate this state:

* **Native (`accent-color`):** Automatically styled by the browser to match `accent-color`.
* **Custom (`appearance: none`):** Render a custom horizontal dash SVG using CSS mask.

```css
/* Native checkboxes inherit the accent color in the indeterminate state */
.checkbox-native:indeterminate {
  accent-color: #1a73e8;
}

/* Custom checkboxes must scale and mask a dash */
.checkbox-custom:indeterminate::before {
  scale: 1;
  mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>') no-repeat center / contain;
}
```


## Best practices

- **DO** use `:focus-visible` rather than `:focus` to style focus indicators on custom checkboxes. This ensures that a distinct keyboard outline is visible for accessibility, but is omitted for mouse/touch clicks.
  ```css
  .checkbox-custom:focus-visible {
    outline: 2px solid #1a73e8;
    outline-offset: 2px;
  }
  ```
- **DO NOT** use `outline: none` or hide focus indicators on checkboxes.
- **DO** ensure the checkbox or the label has an active click/touch target of at least `44px x 44px` to comply with mobile touch guidelines.
- **DO** provide a `:disabled` style variant that lowers opacity, alters background, and sets `cursor: not-allowed` to convey active states clearly.


## Fallback strategies

{{ FEATURE_FALLBACKS("accent-color") }}
{{ FEATURE_FALLBACKS("indeterminate") }}
{{ FEATURE_FALLBACKS("masks") }}
