# Expectations: `autofill-sign-in-form`

- `<input>` elements MUST be within a `<form>` element.
- The form MUST have a submit button using `<button>` or `<input type="submit">`.
- Every `<input>` in the form MUST be visually labeled using a `<label>` element.
- Every `<label>` MUST have a `for` attribute whose value matches the `id` of its associated `<input>`.
- No form element MUST use `autocomplete="off"`.
- The email input MUST have `type="email"`.
- The email input MUST have `autocomplete="username"`. Password managers recognize `username` even when `type="email"` is used, which enables autofill of credentials.
- The password input MUST have `type="password"`.
- The password input MUST have `autocomplete="current-password"`.
- The password input MUST have `id="current-password"`.
- Both the email and password inputs MUST have the `required` attribute.
- There MUST be exactly one email input (do not double-up email fields).
- There MUST be exactly one password input (do not double-up password fields).
