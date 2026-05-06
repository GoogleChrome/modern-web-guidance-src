---
name: autofill-address-form
description: Build an address form with correct autocomplete attributes and autofill support.
web-feature-ids:
  - autofill
sources:
  - https://web.dev/articles/payment-and-address-form-best-practices
  - https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete
  - https://developer.mozilla.org/docs/Web/HTML/Element/form
  - https://developer.mozilla.org/docs/Web/HTML/Element/input
  - https://developer.mozilla.org/docs/Web/HTML/Element/label
---

# Build an address form that follows best practice

Create a form that makes it as easy as possible for users to enter address data on desktop and mobile. Ensure the form makes the most of built-in browser features for autofill, validation and data entry constraints.

## How to implement

Outlined below are the most important guidelines for building successful address forms.

### Use meaningful, valid HTML

{{ INCLUDE("features/forms.md#forms-meaningful-html") }}

### Use the <label> element to label form fields for data entry

{{ INCLUDE("features/forms.md#forms-label-element") }}

### Make the most of HTML attributes

{{ INCLUDE("features/forms.md#forms-html-attributes-intro") }}

```html
<!-- type="email"/"tel" gives mobile users the right keyboard and enables built-in validation -->
<input type="email" id="email" name="email" autocomplete="email" required>
<input type="tel" id="phone" name="phone" autocomplete="tel">
```

{{ INCLUDE("features/forms.md#forms-html-attributes-conclusion") }}

### Make buttons helpful

{{ INCLUDE("features/forms.md#forms-button-element") }}

Give each form submit button a value that says what it does. For each step towards checkout, use a descriptive call-to-action that shows progress and makes the next step obvious. For example, label the submit button on your delivery address form **Proceed to Payment** rather than **Continue** or **Save**.

### Use a single name input where possible

{{ INCLUDE("features/forms.md#forms-single-name") }}

### Allow for a variety of address formats

When building an address form, be aware of the variety of address formats, even within a single country. Do not make assumptions about "normal" addresses.

Use a single `<textarea>` element for the street address if possible.

```html
<!-- textarea handles multi-line international address formats that split inputs can't accommodate -->
<textarea id="address" name="address" autocomplete="street-address" required></textarea>
```

This is the most flexible option for a variety of local and international address formats.

### Help save users from accidentally missing data fields

Add the `required` attribute to mandatory fields.

```html
<input type="text" id="city" name="city" autocomplete="address-level2" required>
```

## Fallback strategies

{{ BASELINE_STATUS("autofill") }}

Autofill is a progressive enhancement. In browsers that do not support autofill, users will simply need to manually enter their address details. The semantic HTML constraints (such as `type`, `inputmode`, and `required`) will still function appropriately as standard form validation.
