---
description: Build accessible and user-friendly address forms using semantic HTML and relevant attributes for improved usability and browser autofill.
filename: address-form-best-practices
category: ui
---

# Address Form Best Practices

Reference docs:
- [HTML Living Standard - Form Controls](https://html.spec.whatwg.org/multipage/forms.html#forms)
- [MDN Web Docs - Autocomplete attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete)
- [MDN Web Docs - Constraint validation](https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/HTML5/Constraint_validation)

## Best Practices

### Semantic HTML and Labels

Always associate a `<label>` with an `<input>`, `<textarea>`, or `<select>` element using the `for` attribute. This improves accessibility by allowing screen readers to announce the label when the input receives focus, and makes the form easier to use by increasing the clickable/tappable area.

```html
<section>
  <label for="name">Name</label>
  <input id="name" name="name">
</section>
```

### Autocomplete for Autofill

Utilize the `autocomplete` attribute to help browsers pre-fill form fields, reducing user input effort and potential errors. Use specific values like `name`, `address`, `postal-code`, and `tel` to guide the browser's suggestions.

```html
<section>
  <label for="name">Name</label>
  <input id="name" name="name" autocomplete="name">
</section>

<section>
  <label for="address">Address</label>
  <textarea id="address" name="address" autocomplete="address"></textarea>
</section>
```

### Constraint Validation

Employ built-in HTML5 constraint validation attributes like `required`, `maxlength`, and `pattern` to enforce data integrity and provide immediate feedback to users without requiring custom JavaScript.

```html
<section>
  <label for="name">Name</label>
  <input id="name" name="name" autocomplete="name"
    maxlength="100" pattern="[\p{L} \-\.]+" required>
</section>
```

The `pattern` attribute, when used with Unicode character properties (e.g., `\p{L}`), allows for broader character support, making your forms more inclusive for international names.

### Flexible Input Types

*   **Textarea for Addresses:** Use `<textarea>` for address fields to provide flexibility for users to enter multi-line addresses and for easy copy-pasting. Avoid splitting addresses into multiple fields unless absolutely necessary.
*   **Single Input for Telephone:** Use a single `<input type="tel">` for telephone numbers. This simplifies data entry, validation, and enables browser autofill.

```html
<section>
  <label for="tel">Telephone</label>
  <input id="tel" name="tel" autocomplete="tel" type="tel"
    maxlength="30" pattern="[\d \-\+]+" enterkeyhint="done"
    required>
</section>
```

### Mobile Keyboard Optimization

Use `type="tel"` for phone numbers to ensure mobile users get an appropriate keyboard. The `enterkeyhint="done"` attribute on the last form field can change the mobile keyboard's enter key to "Done", signaling to the user that the form is complete.

### Input Mode for Numeric Keyboards

For fields that require numeric input but aren't strictly phone numbers (e.g., ZIP codes, card numbers), use `type="text"` (or omit the attribute) and add `inputmode="numeric"` to display a numeric keyboard on mobile devices.

```html
<section>
  <label for="postal-code">ZIP or postal code (optional)</label>
  <input id="postal-code" name="postal-code"
    autocomplete="postal-code" maxlength="20" inputmode="numeric">
</section>
```

## Considerations

### Internationalization and Localization

Be mindful of varying address formats, names for address components (e.g., ZIP vs. postal code), and language differences across regions. Consider implementing mechanisms for customizing forms for multiple locales.

### Country Selectors

Avoid using `<select>` elements for long lists of countries due to poor usability. Explore alternative solutions like custom-built country selectors or libraries that offer better user experience for large datasets.

### Data Minimization

Only ask for the data you absolutely need. Reducing the number of form fields simplifies the user experience, improves privacy, and lowers backend costs and liability.

### Testing

Test your forms across different devices and browsers to ensure a consistent and accessible user experience. Utilize tools like Chrome DevTools Device Mode, send URLs to your phone, or use cross-browser testing platforms.