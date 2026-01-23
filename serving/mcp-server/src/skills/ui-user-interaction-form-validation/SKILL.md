---
description: Improve user experience by providing visual feedback on form input validity only after user interaction, reducing the need for manual state management.
filename: user-interaction-form-validation
category: ui
---

# User-Controlled Form Validation Feedback

Reference docs:
- https://developer.mozilla.org/docs/Web/CSS/:user-valid
- https://developer.mozilla.org/docs/Web/CSS/:user-invalid
- https://drafts.csswg.org/selectors-4/#user-pseudos

## Best Practices

Use the `:user-valid` and `:user-invalid` pseudo-classes to style form controls (`input`, `select`, `textarea`) based on their validation state *after* a user has interacted with them. This provides a better user experience by avoiding initial "invalid" styling on untouched fields.

```css
input:user-valid,
select:user-valid,
textarea:user-valid {
  border-color: green;
}

input:user-invalid,
select:user-invalid,
textarea:user-invalid {
  border-color: red;
}
```

```html
<input required="required" placeholder="Enter text" />

<select required="required">
  <option value="">Choose an option</option>
  <option value="1">One</option>
</select>

<textarea required="required" placeholder="Enter details"></textarea>
```

This approach eliminates the need for custom JavaScript to track user interaction and apply validation styles, simplifying development and improving performance.

## Browser Support

These pseudo-classes are now widely available, reaching **Baseline Newly available** status in October 2023. This means they are supported in all three major browser engines, making them a reliable choice for new development.

Always consider checking browser support for new features, especially if targeting older browsers. However, for `:user-valid` and `:user-invalid`, the widespread adoption makes them a safe bet for modern web applications.