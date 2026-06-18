# Expectations: `autofill-payment-form`

- `<input>`, `<select>`, and `<textarea>` elements **MUST** be within a `<form>` element.
- Every `<input>`, `<select>`, or `<textarea>` element in a form **MUST** be visually labeled using a `<label>` element.
- Every `<label>` element **MUST** have a `for` attribute with a value that matches the `id` attribute of its associated input.
- A single `<input>` element **MUST** be used for entry of a payment card number. Do not split the card number across multiple inputs.
- The card number input **MUST** have `autocomplete="cc-number"`.
- The cardholder name input **MUST** have `autocomplete="cc-name"`.
- The card expiry date input **MUST** have `autocomplete="cc-exp"`.
- The card security code input **MUST** have `autocomplete="cc-csc"`.
- The card number input **MUST** have `inputmode="numeric"` to give mobile users a numeric keyboard.
- The card security code input **MUST** have `inputmode="numeric"`.
- The `type="number"` attribute **MUST NOT** be used on any payment card input field.
- The `type="password"` attribute **MUST NOT** be used on the security code input.
- **DO NOT** enforce Latin-only characters for the cardholder name input (e.g. do not use a `pattern` that only matches `[a-zA-Z]`).
- All required payment form fields **MUST** have the `required` attribute.
- Input format hints **MUST** be positioned above their corresponding input elements in the markup to prevent mobile keyboards from obscuring them.
- The `placeholder` attribute **MUST NOT** be used to convey data entry constraints or format examples.
