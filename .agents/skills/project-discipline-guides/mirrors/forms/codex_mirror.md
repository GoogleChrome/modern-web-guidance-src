# Redundancy Mirror: Forms Development Common Knowledge

This is a broad “common knowledge” guide for modern web form development, based only on inherent knowledge. It focuses on standards-based HTML, CSS, JavaScript, browser APIs, accessibility, validation, progressive enhancement, security, and clean implementation patterns that I would normally apply by default.

## Core Principles

Use native platform features first.

Prefer semantic HTML form controls over custom widgets. Native controls provide keyboard support, accessibility semantics, mobile keyboard optimization, validation hooks, autofill integration, high-contrast support, screen reader support, and browser consistency for free.

Progressively enhance.

A form should ideally work with plain HTML submission first, then gain JavaScript behavior for client-side validation, inline feedback, autosave, optimistic UI, async submission, or richer controls.

Do not replace native behavior unless necessary.

Avoid custom selects, checkboxes, radios, date inputs, sliders, and file pickers unless there is a strong product requirement. If custom controls are unavoidable, implement the full keyboard, focus, ARIA, validation, and form-submission behavior.

Validate on both client and server.

Client-side validation improves UX. Server-side validation is authoritative. Never rely on client-side validation for security, authorization, data integrity, spam prevention, or business rules.

Make invalid states understandable.

Users should know what failed, where it failed, why it failed, and how to fix it. Error messages should be specific and attached to the relevant field.

Use real labels.

Every form control needs an accessible name, usually from a visible `<label>`. Placeholders are not labels.

Preserve user input.

Avoid clearing fields after errors. Preserve entered values, selections, focus context, and scroll position where possible.

Design for interruptions.

Users may navigate away, refresh, submit twice, lose connectivity, use autofill, paste unusual content, zoom, use assistive tech, or interact from touch devices.

## HTML Form Structure

Use `<form>` for form submission boundaries.

```html
<form method="post" action="/signup">
  ...
</form>
```

Use meaningful `method`.

```html
<form method="get" action="/search">
  <input name="q" type="search">
  <button type="submit">Search</button>
</form>
```

Use `GET` for safe, idempotent query-like actions such as search and filtering.

Use `POST` for creating, mutating, authenticating, uploading, or sending private data.

Always specify button type.

```html
<button type="submit">Save</button>
<button type="button">Cancel</button>
<button type="reset">Reset</button>
```

Inside forms, `<button>` defaults to `type="submit"`, which often causes accidental submissions.

Use `name` on successful controls.

Only controls with a `name` participate in native form submission and `FormData`.

```html
<input name="email" type="email">
```

Use stable machine-readable names.

```html
<input name="firstName">
<input name="billingAddress.postalCode">
```

Avoid names tied to presentation such as `leftInput` or `box1`.

Use `<fieldset>` and `<legend>` for grouped controls.

```html
<fieldset>
  <legend>Notification preferences</legend>

  <label>
    <input type="checkbox" name="notifications" value="email">
    Email
  </label>

  <label>
    <input type="checkbox" name="notifications" value="sms">
    SMS
  </label>
</fieldset>
```

Use fieldsets especially for radio groups, checkbox groups, address sections, payment sections, and multi-part questions.

Use `<label>` correctly.

Explicit label:

```html
<label for="email">Email</label>
<input id="email" name="email" type="email">
```

Implicit label:

```html
<label>
  Email
  <input name="email" type="email">
</label>
```

Explicit labels are often easier to style and work reliably with complex layouts.

Do not use placeholder as the only label.

```html
<label for="email">Email</label>
<input id="email" name="email" type="email" placeholder="you@example.com">
```

Use help text outside the placeholder.

```html
<label for="password">Password</label>
<p id="password-help">Use at least 12 characters.</p>
<input id="password" name="password" type="password" aria-describedby="password-help">
```

Use one form per logical submit target.

Avoid wrapping unrelated sections in one large form if they submit independently.

Use `form` attribute when controls live outside the form element.

```html
<form id="profile-form" action="/profile" method="post">
  <input name="displayName">
</form>

<button type="submit" form="profile-form">Save</button>
```

Use `autocomplete` intentionally.

```html
<input name="email" type="email" autocomplete="email">
<input name="given-name" autocomplete="given-name">
<input name="family-name" autocomplete="family-name">
<input name="current-password" type="password" autocomplete="current-password">
<input name="new-password" type="password" autocomplete="new-password">
```

Avoid disabling autocomplete unless necessary. Password managers and autofill are user agents that users rely on.

Use `enctype="multipart/form-data"` for file uploads.

```html
<form method="post" enctype="multipart/form-data">
  <input type="file" name="avatar">
</form>
```

Use `accept` as a hint, not validation.

```html
<input type="file" name="avatar" accept="image/png,image/jpeg">
```

Server must still validate file type, size, content, and security.

Use `multiple` when appropriate.

```html
<input type="file" name="photos" multiple>
<select name="tags" multiple>
```

Use `disabled` and `readonly` correctly.

`disabled` controls are not submitted and are usually skipped by keyboard focus.

```html
<input name="plan" value="pro" disabled>
```

`readonly` controls are submitted and focusable for some input types.

```html
<input name="email" value="user@example.com" readonly>
```

Use `hidden` inputs for non-user-editable submission data, but never trust them.

```html
<input type="hidden" name="csrfToken" value="...">
```

Hidden inputs can be modified by clients.

## Input Types

Use the most specific appropriate input type.

Text:

```html
<input type="text" name="fullName">
```

Email:

```html
<input type="email" name="email" autocomplete="email">
```

Password:

```html
<input type="password" name="password" autocomplete="current-password">
```

Search:

```html
<input type="search" name="q">
```

URL:

```html
<input type="url" name="website">
```

Telephone:

```html
<input type="tel" name="phone" autocomplete="tel">
```

Number:

```html
<input type="number" name="quantity" min="1" max="99" step="1">
```

Date:

```html
<input type="date" name="startDate">
```

Time:

```html
<input type="time" name="startTime">
```

Datetime local:

```html
<input type="datetime-local" name="meetingTime">
```

Month:

```html
<input type="month" name="billingMonth">
```

Week:

```html
<input type="week" name="deliveryWeek">
```

Color:

```html
<input type="color" name="themeColor">
```

Range:

```html
<input type="range" name="volume" min="0" max="100" step="1">
```

Checkbox:

```html
<label>
  <input type="checkbox" name="terms" value="accepted" required>
  I agree to the terms
</label>
```

Radio:

```html
<fieldset>
  <legend>Plan</legend>

  <label>
    <input type="radio" name="plan" value="basic" required>
    Basic
  </label>

  <label>
    <input type="radio" name="plan" value="pro">
    Pro
  </label>
</fieldset>
```

File:

```html
<input type="file" name="resume" accept=".pdf,.doc,.docx">
```

Hidden:

```html
<input type="hidden" name="source" value="newsletter">
```

Submit:

```html
<button type="submit">Submit</button>
```

Avoid `input type="submit"` when a `<button>` is more flexible.

Use `inputmode` for better mobile keyboards.

```html
<input name="zip" inputmode="numeric" autocomplete="postal-code">
<input name="price" inputmode="decimal">
<input name="phone" type="tel" inputmode="tel">
<input name="email" type="email" inputmode="email">
```

Use `type="text"` plus `inputmode` for numeric identifiers that are not numbers.

Examples: ZIP codes, credit card numbers, account numbers, one-time codes.

```html
<input
  name="postalCode"
  type="text"
  inputmode="numeric"
  autocomplete="postal-code"
>
```

Do not use `type="number"` for values where leading zeroes, fixed length, formatting, or non-arithmetic semantics matter.

Use `autocomplete="one-time-code"` for OTP fields.

```html
<input
  name="code"
  type="text"
  inputmode="numeric"
  autocomplete="one-time-code"
  maxlength="6"
/>
```

Use `enterkeyhint` when useful on mobile.

```html
<input type="search" name="q" enterkeyhint="search">
<input name="email" enterkeyhint="next">
```

Common values include `enter`, `done`, `go`, `next`, `previous`, `search`, and `send`.

Use `autocapitalize` for text behavior.

```html
<input name="name" autocapitalize="words">
<input name="email" type="email" autocapitalize="none">
```

Use `spellcheck` where appropriate.

```html
<textarea name="message" spellcheck="true"></textarea>
<input name="username" spellcheck="false" autocapitalize="none">
```

## Textarea

Use `<textarea>` for multi-line text.

```html
<label for="bio">Bio</label>
<textarea id="bio" name="bio" rows="5" maxlength="500"></textarea>
```

Do not put the initial value in a `value` attribute.

```html
<textarea name="comment">Initial text</textarea>
```

Use `rows` to provide a reasonable initial height.

Use character counters only when limits matter.

Use `maxlength` for hard client-side limits, but enforce limits on the server too.

Use CSS resizing intentionally.

```css
textarea {
  resize: vertical;
}
```

## Select, Datalist, and Options

Use `<select>` for constrained choices.

```html
<label for="country">Country</label>
<select id="country" name="country" required>
  <option value="">Select a country</option>
  <option value="us">United States</option>
  <option value="ca">Canada</option>
</select>
```

Use an empty first option for required selects when no default should be chosen.

Use meaningful submitted values.

```html
<option value="standard">Standard shipping</option>
<option value="express">Express shipping</option>
```

Use `<optgroup>` for grouped options.

```html
<select name="timezone">
  <optgroup label="North America">
    <option value="America/New_York">Eastern Time</option>
    <option value="America/Chicago">Central Time</option>
  </optgroup>
</select>
```

Use `<datalist>` for suggestions, not strict selection.

```html
<label for="city">City</label>
<input id="city" name="city" list="city-options">

<datalist id="city-options">
  <option value="New York">
  <option value="Los Angeles">
  <option value="Chicago">
</datalist>
```

A datalist allows arbitrary input. Validate accordingly.

## Validation Attributes

Use native validation attributes where appropriate.

Required:

```html
<input name="email" type="email" required>
```

Length:

```html
<input name="username" minlength="3" maxlength="20">
```

Numeric range:

```html
<input name="age" type="number" min="18" max="120">
```

Step:

```html
<input name="quantity" type="number" min="1" step="1">
```

Pattern:

```html
<input
  name="username"
  pattern="[A-Za-z0-9_]{3,20}"
  title="Use 3 to 20 letters, numbers, or underscores."
>
```

Use `pattern` carefully. It is easy to make regex validation too strict, especially for names, addresses, phone numbers, emails, and international input.

Use built-in type validation when possible.

```html
<input type="email" name="email">
<input type="url" name="website">
```

Use `novalidate` when replacing native validation UI with custom validation, while still using the Constraint Validation API.

```html
<form novalidate>
  ...
</form>
```

Avoid disabling validation without replacing it.

Use `formnovalidate` for alternate submit actions.

```html
<button type="submit">Publish</button>
<button type="submit" formnovalidate name="intent" value="draft">
  Save draft
</button>
```

## Constraint Validation API

Use `checkValidity()` to test validity and fire invalid events.

```js
const form = document.querySelector("form");

if (!form.checkValidity()) {
  // invalid events fire on controls
}
```

Use `reportValidity()` to show browser validation UI.

```js
form.reportValidity();
```

Use `setCustomValidity()` for custom messages.

```js
const input = document.querySelector("#username");

input.setCustomValidity("");

if (input.value.includes(" ")) {
  input.setCustomValidity("Usernames cannot contain spaces.");
}
```

Always clear custom validity when the value becomes valid.

```js
input.addEventListener("input", () => {
  input.setCustomValidity("");

  if (input.value && input.value.length < 3) {
    input.setCustomValidity("Use at least 3 characters.");
  }
});
```

Use `validity` for precise states.

```js
if (input.validity.valueMissing) {
  input.setCustomValidity("Enter your email address.");
} else if (input.validity.typeMismatch) {
  input.setCustomValidity("Enter a valid email address.");
} else {
  input.setCustomValidity("");
}
```

Common `ValidityState` properties:

```js
input.validity.valueMissing;
input.validity.typeMismatch;
input.validity.patternMismatch;
input.validity.tooShort;
input.validity.tooLong;
input.validity.rangeUnderflow;
input.validity.rangeOverflow;
input.validity.stepMismatch;
input.validity.badInput;
input.validity.customError;
input.validity.valid;
```

Use `validationMessage` for the current message.

```js
console.log(input.validationMessage);
```

Use `invalid` event for field-level handling.

```js
form.addEventListener(
  "invalid",
  (event) => {
    const field = event.target;
    field.classList.add("is-invalid");
  },
  true
);
```

The `invalid` event does not bubble, so use capture if listening on the form.

Use `requestSubmit()` instead of `submit()` for programmatic submission.

```js
form.requestSubmit();
```

`requestSubmit()` behaves like clicking a submit button: it runs validation and submit event handlers.

`form.submit()` bypasses validation and submit handlers.

Use `SubmitEvent.submitter` to identify which button submitted the form.

```js
form.addEventListener("submit", (event) => {
  const button = event.submitter;
  const intent = button?.value;
});
```

Use custom validity for cross-field validation.

```js
const password = form.elements.password;
const confirmPassword = form.elements.confirmPassword;

function validatePasswords() {
  confirmPassword.setCustomValidity("");

  if (confirmPassword.value && confirmPassword.value !== password.value) {
    confirmPassword.setCustomValidity("Passwords do not match.");
  }
}

password.addEventListener("input", validatePasswords);
confirmPassword.addEventListener("input", validatePasswords);
```

Validate cross-field constraints at submission too.

```js
form.addEventListener("submit", (event) => {
  validatePasswords();

  if (!form.reportValidity()) {
    event.preventDefault();
  }
});
```

## FormData

Use `FormData` to read form values in a standards-based way.

```js
const formData = new FormData(form);
```

Get a single value:

```js
const email = formData.get("email");
```

Get repeated values:

```js
const tags = formData.getAll("tags");
```

Set a value:

```js
formData.set("email", "user@example.com");
```

Append repeated values:

```js
formData.append("tags", "javascript");
```

Delete a value:

```js
formData.delete("draft");
```

Iterate entries:

```js
for (const [name, value] of formData) {
  console.log(name, value);
}
```

Convert simple forms to object carefully.

```js
const data = Object.fromEntries(new FormData(form));
```

This loses repeated values such as checkbox groups and multi-selects.

Handle repeated values explicitly.

```js
const formData = new FormData(form);

const data = {
  email: formData.get("email"),
  interests: formData.getAll("interests"),
};
```

Use the `formdata` event to augment native submissions.

```js
form.addEventListener("formdata", (event) => {
  event.formData.append("clientTimestamp", new Date().toISOString());
});
```

Use `new FormData(form, submitter)` when submitter-specific data matters, where supported.

```js
const formData = new FormData(form, event.submitter);
```

Use `URLSearchParams` for GET-style query bodies when files are not involved.

```js
const params = new URLSearchParams(new FormData(form));
location.href = `/search?${params}`;
```

Do not use `URLSearchParams` for `File` values.

## Async Submission

Intercept submit with `submit` event.

```js
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!form.reportValidity()) return;

  const formData = new FormData(form);

  const response = await fetch(form.action, {
    method: form.method,
    body: formData,
  });

  if (!response.ok) {
    // show error
    return;
  }

  // show success
});
```

Let the browser set `Content-Type` for `FormData`.

Do not manually set `Content-Type: multipart/form-data`; the browser must include the boundary.

Use JSON only when the server expects JSON and files are not needed.

```js
const data = Object.fromEntries(new FormData(form));

await fetch(form.action, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(data),
});
```

Include credentials intentionally.

```js
await fetch("/profile", {
  method: "POST",
  body: new FormData(form),
  credentials: "same-origin",
});
```

Use `AbortController` to cancel stale submissions.

```js
let currentController;

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  currentController?.abort();

  const controller = new AbortController();
  currentController = controller;

  try {
    await fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name !== "AbortError") throw error;
  }
});
```

Disable submit controls during active submission.

```js
const submitButton = form.querySelector('[type="submit"]');

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  submitButton.disabled = true;

  try {
    await submitForm();
  } finally {
    submitButton.disabled = false;
  }
});
```

Avoid permanently trapping users in a disabled state.

Use idempotency keys for operations that must not run twice.

```html
<input type="hidden" name="idempotencyKey" value="...">
```

Server must enforce idempotency.

Handle double-clicks and repeated submissions.

Use `aria-busy` to communicate loading state.

```html
<form aria-busy="false">
  ...
</form>
```

```js
form.setAttribute("aria-busy", "true");
form.setAttribute("aria-busy", "false");
```

Use optimistic UI only when rollback is clear.

For critical operations such as payments, account deletion, security changes, or booking, prefer confirmed server response before showing completion.

## Error Handling

Show field-level errors near fields.

```html
<label for="email">Email</label>
<input id="email" name="email" type="email" aria-describedby="email-error">
<p id="email-error" class="field-error"></p>
```

Set `aria-invalid` when invalid.

```js
input.setAttribute("aria-invalid", "true");
```

Remove it when valid.

```js
input.removeAttribute("aria-invalid");
```

Use `aria-describedby` to associate help and error text.

```html
<input
  id="password"
  name="password"
  type="password"
  aria-describedby="password-help password-error"
>
<p id="password-help">Use at least 12 characters.</p>
<p id="password-error"></p>
```

Use a summary for multiple errors.

```html
<div role="alert" tabindex="-1" id="error-summary">
  <h2>Fix the following errors</h2>
  <ul>
    <li><a href="#email">Enter a valid email address.</a></li>
  </ul>
</div>
```

Move focus to an error summary after failed submission when helpful.

```js
errorSummary.focus();
```

Do not move focus on every keystroke.

Use live regions sparingly.

```html
<p id="form-status" role="status"></p>
```

`role="status"` is polite. `role="alert"` is assertive and should be reserved for urgent or submission-level errors.

Avoid only using color to indicate errors.

Pair color with text, icons, borders, or messages.

Error messages should be actionable.

Poor:

```text
Invalid input.
```

Better:

```text
Enter an email address in the format name@example.com.
```

Do not expose sensitive server details in errors.

For authentication, avoid revealing whether the username or password was wrong.

```text
The email or password is incorrect.
```

## Accessibility

Every control needs an accessible name.

Use visible labels for normal fields.

Use `aria-label` only when a visible label is impractical.

```html
<input type="search" name="q" aria-label="Search">
```

Prefer `aria-labelledby` when visible text exists.

```html
<h2 id="shipping-heading">Shipping address</h2>
<section aria-labelledby="shipping-heading">
  ...
</section>
```

Do not use ARIA to override native semantics unless necessary.

Native:

```html
<button type="submit">Save</button>
```

Avoid:

```html
<div role="button" tabindex="0">Save</div>
```

Use real buttons for actions and links for navigation.

```html
<button type="button">Open menu</button>
<a href="/settings">Settings</a>
```

Maintain keyboard support.

Users should be able to tab through fields, activate controls, select radio/checkbox options, submit, and recover from errors using the keyboard.

Do not remove visible focus outlines without replacing them.

```css
:focus-visible {
  outline: 2px solid Highlight;
  outline-offset: 2px;
}
```

Use `:focus-visible` for keyboard-focused styling.

```css
button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
```

Use logical focus order.

DOM order should generally match visual order.

Avoid positive `tabindex`.

```html
<!-- Avoid -->
<input tabindex="3">
```

Use `tabindex="-1"` for programmatic focus targets like error summaries.

```html
<div id="error-summary" tabindex="-1"></div>
```

Respect zoom and text resizing.

Avoid fixed heights that clip text. Use flexible layouts and adequate line-height.

Target touch sizes should be comfortable.

Interactive controls should generally have a target size around 44 CSS pixels or more where practical.

Use sufficient color contrast.

Text, borders used as the only indicator, error messages, placeholders, and disabled states should remain readable.

Do not make disabled controls so low-contrast that users cannot understand them.

Use `aria-required` only when native `required` cannot be used.

```html
<input required>
```

Use native `required` for real form fields.

Use `aria-invalid`.

```html
<input aria-invalid="true">
```

Use `aria-errormessage` carefully.

```html
<input aria-invalid="true" aria-errormessage="email-error">
<p id="email-error">Enter a valid email address.</p>
```

`aria-describedby` has broader practical use for help and errors.

Do not announce every character or validation state aggressively.

Validate on blur or submit for many fields. Use live validation on input only when the feedback is genuinely useful and not noisy.

For radio groups, the group label should be in `<legend>`.

For custom composite widgets, follow established ARIA patterns.

Examples: combobox, listbox, date picker, slider, switch. Implement keyboard interaction fully or use a well-tested library.

## CSS for Forms

Use `box-sizing: border-box`.

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}
```

Use readable default styling.

```css
input,
select,
textarea,
button {
  font: inherit;
}
```

Use `display: block` or layout utilities for stacked fields.

```css
.form-field {
  display: grid;
  gap: 0.375rem;
}
```

Use adequate spacing.

Group label, input, help text, and error text clearly.

Avoid relying on placeholder color as primary text.

```css
::placeholder {
  color: color-mix(in srgb, currentColor 55%, transparent);
}
```

Use modern selectors where supported.

```css
.field:has(input:required) label::after {
  content: " *";
}
```

Use `:has()` as progressive enhancement if needed.

```css
.field:has(:invalid) {
  border-color: red;
}
```

Be careful with `:invalid`; empty required fields match `:invalid` before interaction.

Use user-interaction-aware patterns.

```css
input:user-invalid {
  border-color: red;
}
```

Where `:user-invalid` is unavailable or inconsistent, use JS-added classes after blur or submit.

```css
.was-submitted input:invalid {
  border-color: red;
}
```

Use `accent-color` for native checkboxes, radios, and ranges.

```css
input[type="checkbox"],
input[type="radio"] {
  accent-color: #0f766e;
}
```

Use `color-scheme` if supporting dark UI.

```css
:root {
  color-scheme: light dark;
}
```

This lets native controls adapt to light/dark modes.

Style disabled states accessibly.

```css
:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}
```

Do not use opacity alone if it makes text unreadable.

Use `appearance: none` cautiously.

```css
.custom-input {
  appearance: none;
}
```

Removing native appearance can remove useful affordances. Rebuild focus, disabled, checked, invalid, and high-contrast states.

Use `resize: vertical` for textareas.

```css
textarea {
  resize: vertical;
}
```

Avoid fixed widths.

```css
input,
select,
textarea {
  width: 100%;
  max-width: 100%;
}
```

Use logical properties.

```css
.field {
  margin-block-end: 1rem;
}
```

Use container queries or responsive layout where forms sit in variable-width containers.

```css
.form-grid {
  container-type: inline-size;
}

@container (min-width: 40rem) {
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
```

Avoid layout shifts when errors appear.

Reserve space if necessary, or place errors predictably below controls.

Use `min-height` for error slots only when it improves stability.

## Modern CSS Selectors and States

Use `:required` and `:optional`.

```css
input:required {
  ...
}
```

Use `:valid` and `:invalid` carefully.

```css
input:invalid {
  ...
}
```

Use `:placeholder-shown` for floating labels only with care.

```css
input:placeholder-shown + label {
  ...
}
```

Floating labels can harm usability if labels become too small or if autofill creates state bugs.

Use `:disabled`, `:enabled`, `:read-only`, `:read-write`.

```css
input:read-only {
  background: Canvas;
}
```

Use `:checked`.

```css
input[type="radio"]:checked {
  ...
}
```

Use `:indeterminate` for partially selected checkbox states.

```js
checkbox.indeterminate = true;
```

```css
input:indeterminate {
  ...
}
```

Use `:focus-within` for field wrappers.

```css
.field:focus-within {
  outline: 1px solid currentColor;
}
```

Use `:focus-visible` for keyboard focus.

Use `:has()` for parent styling.

```css
.field:has(input[aria-invalid="true"]) {
  ...
}
```

Use `@supports selector(:has(*))` if needed.

```css
@supports selector(:has(*)) {
  .field:has(:invalid) {
    ...
  }
}
```

## Autofill and Password Managers

Use correct `autocomplete` tokens.

Common tokens:

```html
autocomplete="name"
autocomplete="honorific-prefix"
autocomplete="given-name"
autocomplete="additional-name"
autocomplete="family-name"
autocomplete="honorific-suffix"
autocomplete="nickname"
autocomplete="username"
autocomplete="new-password"
autocomplete="current-password"
autocomplete="one-time-code"
autocomplete="organization-title"
autocomplete="organization"
autocomplete="street-address"
autocomplete="address-line1"
autocomplete="address-line2"
autocomplete="address-line3"
autocomplete="address-level1"
autocomplete="address-level2"
autocomplete="address-level3"
autocomplete="address-level4"
autocomplete="country"
autocomplete="country-name"
autocomplete="postal-code"
autocomplete="cc-name"
autocomplete="cc-given-name"
autocomplete="cc-family-name"
autocomplete="cc-number"
autocomplete="cc-exp"
autocomplete="cc-exp-month"
autocomplete="cc-exp-year"
autocomplete="cc-csc"
autocomplete="cc-type"
autocomplete="transaction-currency"
autocomplete="transaction-amount"
autocomplete="language"
autocomplete="bday"
autocomplete="bday-day"
autocomplete="bday-month"
autocomplete="bday-year"
autocomplete="sex"
autocomplete="url"
autocomplete="photo"
autocomplete="tel"
autocomplete="tel-country-code"
autocomplete="tel-national"
autocomplete="tel-area-code"
autocomplete="tel-local"
autocomplete="tel-extension"
autocomplete="email"
autocomplete="impp"
```

Use section prefixes to distinguish repeated groups.

```html
<input autocomplete="section-billing street-address">
<input autocomplete="section-shipping street-address">
```

Do not block paste into password or OTP fields.

Do not block password managers with unusual field names or fake inputs.

Do not set `autocomplete="off"` on login fields unless there is a very specific reason.

For new password forms:

```html
<input name="username" autocomplete="username">
<input name="newPassword" type="password" autocomplete="new-password">
```

For login forms:

```html
<input name="username" autocomplete="username">
<input name="password" type="password" autocomplete="current-password">
```

Use `name`, `id`, labels, and autocomplete values that password managers can understand.

## Internationalization

Do not over-constrain human names.

Names may include spaces, apostrophes, hyphens, accents, non-Latin scripts, single names, long names, and different ordering.

Do not assume addresses have the same fields in all countries.

Address formats vary by country. Postal codes may contain letters, spaces, hyphens, or be absent.

Do not assume phone numbers are numeric-only.

Phone numbers can include `+`, spaces, parentheses, extensions, and country-specific formatting.

Use `type="tel"` for phone input.

```html
<input name="phone" type="tel" autocomplete="tel">
```

Do not use `type="number"` for phone numbers.

Use locale-aware formatting for display.

```js
new Intl.NumberFormat(locale, {
  style: "currency",
  currency: "USD",
}).format(amount);
```

Use `Intl.DateTimeFormat` for display dates.

```js
new Intl.DateTimeFormat(locale, {
  dateStyle: "medium",
}).format(date);
```

Be careful with native date inputs.

`input[type="date"]` submits a normalized `YYYY-MM-DD` value but displays according to browser locale. This is usually good, but server parsing must expect the submitted format.

Handle time zones explicitly.

`datetime-local` does not include a time zone. Treat it as local wall-clock time and combine with known user or business timezone server-side when needed.

Use `dir="auto"` where user-generated text may be bidirectional.

```html
<input name="displayName" dir="auto">
<textarea name="message" dir="auto"></textarea>
```

Avoid hard-coded English-only validation patterns.

Use translatable labels, help text, error messages, and status messages.

## Security

Server-side validation is mandatory.

Validate and sanitize all submitted data on the server.

Use CSRF protection for state-changing requests when authentication cookies are involved.

```html
<input type="hidden" name="csrfToken" value="...">
```

Use SameSite cookies where appropriate.

Use HTTPS for forms that submit sensitive data.

Never log sensitive form data unnecessarily.

Sensitive data includes passwords, tokens, payment details, government IDs, health data, private messages, and authentication answers.

Do not store passwords in client-side state longer than necessary.

Do not echo raw submitted HTML back into the page.

Escape output to prevent XSS.

Use Content Security Policy as defense in depth.

Use rate limiting and abuse detection for public forms.

Use bot mitigation carefully.

Avoid inaccessible CAPTCHAs where possible. Consider rate limits, honeypots, proof-of-work, email verification, or risk-based checks.

Do not trust hidden fields.

Do not trust disabled fields.

Do not trust select options or radio values.

Clients can modify all submitted data.

For file uploads, validate:

```text
size
MIME type
file extension
actual file signature/content
image dimensions when relevant
malware risk
storage location
authorization
```

Store uploads outside executable web roots when possible.

Generate server-side file names.

Strip metadata when appropriate.

For authentication forms, use generic errors.

For password reset flows, avoid revealing whether an account exists.

For payment forms, prefer hosted payment fields or provider SDKs to reduce compliance scope.

## Privacy

Collect the minimum data needed.

Explain why sensitive data is required.

Avoid optional tracking fields unless necessary.

Do not prefill sensitive information in shared contexts.

Use `autocomplete` appropriately, but avoid exposing private data in the wrong form.

Avoid storing form drafts containing sensitive information without user awareness.

Use secure storage practices.

Do not put sensitive data in URLs.

GET query parameters may appear in history, logs, analytics, referrers, and screenshots.

## Performance

Keep forms lightweight.

Avoid heavy client-side libraries for simple forms.

Debounce expensive validation.

```js
function debounce(callback, delay) {
  let timeoutId;

  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callback(...args), delay);
  };
}
```

Use server-side uniqueness checks sparingly and asynchronously.

```js
const checkUsername = debounce(async () => {
  ...
}, 300);
```

Cancel stale async validation with `AbortController`.

Avoid validating every keystroke with network requests.

Use native inputs instead of large custom widgets.

Lazy-load complex controls such as rich text editors, address autocomplete, or payment SDKs.

Avoid layout shifts from validation messages.

Avoid blocking initial rendering with form enhancement scripts.

Use event delegation for large dynamic forms.

```js
form.addEventListener("input", (event) => {
  if (event.target.matches("[data-validate]")) {
    validateField(event.target);
  }
});
```

## Clean JavaScript Patterns

Select forms by stable hooks.

```html
<form data-profile-form>
```

```js
const form = document.querySelector("[data-profile-form]");
```

Avoid coupling JS to presentation classes if those classes are likely to change.

Use `form.elements`.

```js
const email = form.elements.email;
```

Remember that `form.elements.name` can conflict with form properties. Bracket access is safer for unusual names.

```js
const field = form.elements["billing.postalCode"];
```

Keep validation functions pure where practical.

```js
function getEmailError(value) {
  if (!value) return "Enter your email address.";
  if (!value.includes("@")) return "Enter a valid email address.";
  return "";
}
```

Separate state, validation, rendering, and submission.

```js
function validate(form) {
  ...
}

function renderErrors(errors) {
  ...
}

async function submit(data) {
  ...
}
```

Use early returns.

```js
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!form.reportValidity()) return;

  await submitForm(form);
});
```

Handle errors explicitly.

```js
try {
  await submitForm(form);
} catch (error) {
  showFormError("Something went wrong. Try again.");
}
```

Do not swallow errors silently.

Use `addEventListener`, not inline event handlers.

```js
button.addEventListener("click", handleClick);
```

Avoid:

```html
<button onclick="handleClick()">Save</button>
```

Clean up event listeners when components unmount.

```js
const controller = new AbortController();

input.addEventListener("input", handleInput, {
  signal: controller.signal,
});

controller.abort();
```

Use `dataset` for declarative behavior.

```html
<input data-min-age="18">
```

```js
const minAge = Number(input.dataset.minAge);
```

Be careful with type conversion.

```js
const age = Number(formData.get("age"));

if (!Number.isFinite(age)) {
  ...
}
```

Use `valueAsNumber` for numeric/date-like inputs when appropriate.

```js
const amount = input.valueAsNumber;
```

Use `valueAsDate` for compatible date inputs.

```js
const date = dateInput.valueAsDate;
```

Know that empty numeric inputs produce `NaN` for `valueAsNumber`.

Use `matches`, `closest`, and event delegation.

```js
form.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-item]");
  if (!removeButton) return;

  removeButton.closest("[data-item]").remove();
});
```

Use templates for dynamic fields.

```html
<template id="phone-template">
  <div data-phone-row>
    <label>
      Phone
      <input name="phones[]" type="tel">
    </label>
    <button type="button" data-remove-phone>Remove</button>
  </div>
</template>
```

```js
const template = document.querySelector("#phone-template");
const clone = template.content.cloneNode(true);
container.append(clone);
```

When adding dynamic controls, ensure unique IDs.

```js
const id = `phone-${crypto.randomUUID()}`;
label.htmlFor = id;
input.id = id;
```

Use `crypto.randomUUID()` where available for unique client IDs.

## Submission Intents

Use named submit buttons for multiple actions.

```html
<button type="submit" name="intent" value="save">Save</button>
<button type="submit" name="intent" value="publish">Publish</button>
```

Read the submitter.

```js
form.addEventListener("submit", (event) => {
  const intent = event.submitter?.value;
});
```

Use `formaction`, `formmethod`, `formenctype`, and `formtarget` for per-button behavior.

```html
<button type="submit">Save</button>
<button type="submit" formaction="/preview" formtarget="_blank">
  Preview
</button>
```

Use `formnovalidate` for drafts or previews where incomplete data is allowed.

```html
<button type="submit" name="intent" value="draft" formnovalidate>
  Save draft
</button>
```

## Dynamic Forms

When adding or removing fields, maintain:

```text
name attributes
label associations
error associations
focus behavior
validation rules
serialization
server expectations
```

For repeated fields, use a consistent naming convention.

```html
<input name="emails[]" type="email">
<input name="emails[]" type="email">
```

Or structured indexes:

```html
<input name="contacts[0][email]" type="email">
<input name="contacts[1][email]" type="email">
```

Match server parsing expectations.

After adding a new field, focus it if the user initiated the action.

```js
newInput.focus();
```

After removing a field, move focus to a logical nearby control.

Do not unexpectedly remove user-entered data.

Ask for confirmation before deleting complex unsaved sections.

Use event delegation so dynamically added fields work automatically.

## File Uploads

Use file input.

```html
<input type="file" name="documents" multiple>
```

Use `accept` as a user convenience.

```html
<input type="file" accept="image/*">
```

For camera capture on mobile, `capture` can hint at direct capture.

```html
<input type="file" accept="image/*" capture="environment">
```

Treat `capture` as progressive enhancement.

Read selected files from `input.files`.

```js
for (const file of input.files) {
  console.log(file.name, file.size, file.type);
}
```

Use `FileReader` or object URLs for previews.

```js
const url = URL.createObjectURL(file);
image.src = url;

image.addEventListener("load", () => {
  URL.revokeObjectURL(url);
});
```

Validate file size client-side for UX.

```js
const maxSize = 5 * 1024 * 1024;

if (file.size > maxSize) {
  input.setCustomValidity("Choose a file smaller than 5 MB.");
}
```

Still validate server-side.

Use drag-and-drop as enhancement, not the only upload path.

```js
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  input.files = event.dataTransfer.files;
});
```

Assigning to `input.files` may be limited depending on browser/security context. Always keep the native file input usable.

For upload progress, use `XMLHttpRequest` upload progress events or a fetch upload streaming approach where supported. Plain `fetch` historically lacks simple upload progress.

```js
const xhr = new XMLHttpRequest();

xhr.upload.addEventListener("progress", (event) => {
  if (!event.lengthComputable) return;
  const percent = (event.loaded / event.total) * 100;
});
```

## Dates and Times

Use native date/time controls when they meet product needs.

```html
<input type="date" name="startDate">
<input type="time" name="startTime">
<input type="datetime-local" name="startsAt">
```

Understand submitted formats:

```text
date: YYYY-MM-DD
time: HH:mm or HH:mm:ss
datetime-local: YYYY-MM-DDTHH:mm
month: YYYY-MM
week: YYYY-Www
```

Do not store ambiguous local date-times without knowing the intended timezone.

For birthdays and calendar dates, a date without timezone is often correct.

For moments in time, convert to an instant with timezone context.

Use min/max for date constraints.

```html
<input type="date" name="arrival" min="2026-01-01" max="2026-12-31">
```

Avoid complex date regexes.

Use date parsing libraries or server validation for complex calendars and time zones when necessary.

## Numbers, Currency, and Measurement

Use `type="number"` for real numeric quantities.

```html
<input type="number" name="quantity" min="1" step="1">
```

Do not use `type="number"` for:

```text
credit cards
ZIP/postal codes
phone numbers
account numbers
IDs with leading zeroes
fixed-length numeric codes
```

Use `inputmode="decimal"` for decimal entry when storing a string or applying locale-aware parsing.

```html
<input name="amount" inputmode="decimal">
```

Currency entry is tricky because locale formatting differs.

Prefer storing minor units server-side, such as cents, after reliable parsing.

Use `Intl.NumberFormat` for display, not necessarily parsing.

Avoid floating-point errors for money. Use integers for minor units or decimal libraries.

## Search and Filter Forms

Use `method="get"` for shareable URLs.

```html
<form method="get" action="/products">
  <input type="search" name="q">
  <select name="sort">
    <option value="relevance">Relevance</option>
    <option value="price">Price</option>
  </select>
  <button type="submit">Apply</button>
</form>
```

Preserve query state in inputs.

Use empty values intentionally.

Avoid submitting meaningless empty parameters when possible, though this can be handled server-side.

For live search, debounce input and update results progressively.

Keep a submit button for accessibility and non-JS fallback.

Update URL query params for shareability.

## Authentication Forms

Use correct autocomplete.

Login:

```html
<input name="username" autocomplete="username">
<input name="password" type="password" autocomplete="current-password">
```

Signup/change password:

```html
<input name="username" autocomplete="username">
<input name="password" type="password" autocomplete="new-password">
```

Allow paste into password fields.

Do not impose arbitrary low maximum password lengths.

Support password managers.

Use clear password requirement messaging.

Avoid composition rules that reduce security and usability, such as requiring one uppercase, one lowercase, one number, and one symbol while limiting length severely.

Prefer minimum length and breached-password checks server-side.

Provide show/hide password toggle as a real button.

```html
<button type="button" aria-controls="password" aria-pressed="false">
  Show password
</button>
```

```js
button.addEventListener("click", () => {
  const showing = password.type === "text";
  password.type = showing ? "password" : "text";
  button.setAttribute("aria-pressed", String(!showing));
  button.textContent = showing ? "Show password" : "Hide password";
});
```

Maintain focus when toggling password visibility.

Use generic authentication error messages.

Use rate limiting and account protection server-side.

For MFA/OTP, use `autocomplete="one-time-code"`.

```html
<input
  name="code"
  inputmode="numeric"
  autocomplete="one-time-code"
  maxlength="6"
/>
```

## Payment Forms

Prefer payment provider-hosted fields for card data.

Use autocomplete tokens for payment fields when implementing them.

```html
<input name="cc-name" autocomplete="cc-name">
<input name="cc-number" autocomplete="cc-number" inputmode="numeric">
<input name="cc-exp" autocomplete="cc-exp">
<input name="cc-csc" autocomplete="cc-csc" inputmode="numeric">
```

Do not use `type="number"` for card numbers.

Card numbers can be long, have leading digits that matter, and should not expose number input spinners.

Format card numbers visually without changing the submitted canonical value unless handled carefully.

Validate card details with provider/server validation.

Do not store card data unless compliant with payment standards.

Use the Payment Request API only as progressive enhancement where it fits and is supported.

## Contact, Address, and Profile Forms

Use appropriate autocomplete fields.

```html
<input name="givenName" autocomplete="given-name">
<input name="familyName" autocomplete="family-name">
<input name="email" type="email" autocomplete="email">
<input name="phone" type="tel" autocomplete="tel">
<input name="street" autocomplete="street-address">
<input name="city" autocomplete="address-level2">
<input name="region" autocomplete="address-level1">
<input name="postalCode" autocomplete="postal-code">
<input name="country" autocomplete="country">
```

Support international address differences.

Do not assume state/province is required.

Do not assume postal code exists.

Let users enter organization, apartment, unit, or address line 2 where needed.

For country selectors, use stable country codes as values.

```html
<option value="US">United States</option>
<option value="CA">Canada</option>
```

## Mobile Forms

Use appropriate input types and `inputmode`.

Use visible labels and large enough controls.

Avoid tiny inline links inside labels when they are hard to tap.

Place related controls close together.

Avoid layouts requiring horizontal scrolling.

Use `autocomplete` to reduce typing.

Use `enterkeyhint` to guide virtual keyboard actions.

Avoid fixed-position footers that cover fields when the keyboard opens unless carefully handled.

Test with viewport resizing and virtual keyboard behavior.

Do not rely only on hover.

## Progressive Enhancement

Start with a working HTML form.

```html
<form method="post" action="/subscribe">
  <label for="email">Email</label>
  <input id="email" name="email" type="email" required>
  <button type="submit">Subscribe</button>
</form>
```

Enhance with JS.

```js
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  ...
});
```

If JS fails, the form should still submit.

Use feature detection.

```js
if ("FormData" in window && "fetch" in window) {
  enhanceForm();
}
```

Use CSS feature queries.

```css
@supports selector(:has(*)) {
  ...
}
```

Use cutting-edge features only when optional.

Examples of progressive features:

```text
:has()
:user-valid / :user-invalid
popover for lightweight field help or custom pickers
showPicker() for supported date/color/file controls
form-associated custom elements
Payment Request API
View Transitions around form-driven navigation
```

Always provide a fallback.

## Form-Associated Custom Elements

For custom elements that need to participate in forms, use form-associated custom elements where supported.

```js
class CustomRating extends HTMLElement {
  static formAssociated = true;

  #internals = this.attachInternals();

  set value(value) {
    this.#internals.setFormValue(value);
  }

  setValidity(flags, message, anchor) {
    this.#internals.setValidity(flags, message, anchor);
  }
}

customElements.define("custom-rating", CustomRating);
```

This is advanced and should be used only when a real custom form control is necessary.

Provide fallback hidden inputs if needed.

## Popover and Dialog in Forms

Use `<dialog>` for modal confirmation flows.

```html
<dialog id="confirm-dialog">
  <form method="dialog">
    <p>Discard changes?</p>
    <button value="cancel">Cancel</button>
    <button value="confirm">Discard</button>
  </form>
</dialog>
```

Use `showModal()` for modal dialogs.

```js
dialog.showModal();
```

Use the Popover API for lightweight non-modal UI where supported.

```html
<button type="button" popovertarget="password-help">Password help</button>
<div id="password-help" popover>
  Use at least 12 characters.
</div>
```

Treat popover as progressive enhancement if support or UX requirements demand fallback.

Do not put essential error text only in a popover.

## Dirty State and Unsaved Changes

Track whether users changed a form.

```js
let dirty = false;

form.addEventListener("input", () => {
  dirty = true;
});
```

Warn before leaving only when there are meaningful unsaved changes.

```js
window.addEventListener("beforeunload", (event) => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = "";
});
```

Use sparingly. Browser UI is generic.

Clear dirty state after successful submit.

```js
dirty = false;
```

Consider autosave for long forms.

Use local storage cautiously.

Do not store sensitive fields in local storage.

## Autosave

Debounce autosave.

```js
const autosave = debounce(async () => {
  const formData = new FormData(form);
  await fetch("/draft", {
    method: "POST",
    body: formData,
  });
}, 1000);

form.addEventListener("input", autosave);
```

Show save status accessibly.

```html
<p role="status" id="save-status"></p>
```

Handle conflicts and stale saves.

Use server-generated revision IDs or timestamps.

Do not autosave passwords, payment info, secrets, or highly sensitive fields.

## Reset and Clear

Use reset carefully.

```html
<button type="reset">Reset</button>
```

Reset returns controls to initial values, not empty values.

Confirm destructive resets for long forms.

Listen for `reset` if UI state needs clearing.

```js
form.addEventListener("reset", () => {
  clearErrors();
});
```

Because reset occurs before values update in some patterns, defer when necessary.

```js
form.addEventListener("reset", () => {
  queueMicrotask(clearErrors);
});
```

## Browser Events

Useful form events:

```text
input
change
submit
reset
invalid
formdata
focus
blur
focusin
focusout
beforeinput
compositionstart
compositionupdate
compositionend
```

Use `input` for immediate value changes.

Use `change` for committed changes, especially selects, checkboxes, radios, and file inputs.

Use `focusin` and `focusout` when you need bubbling focus events.

Use composition events or avoid aggressive validation during IME composition.

```js
let composing = false;

input.addEventListener("compositionstart", () => {
  composing = true;
});

input.addEventListener("compositionend", () => {
  composing = false;
  validate();
});

input.addEventListener("input", () => {
  if (!composing) validate();
});
```

Use `beforeinput` only for advanced editing behavior.

Avoid blocking input unless absolutely necessary. Validate after entry instead.

## Data Normalization

Trim values where appropriate.

```js
const email = String(formData.get("email") ?? "").trim();
```

Do not blindly trim fields where whitespace may be meaningful.

Normalize email cautiously.

Usually trim and maybe lowercase the domain. Do not assume all local parts are case-insensitive, though many systems treat them that way.

Normalize phone numbers server-side using a dedicated library when needed.

Normalize Unicode where needed.

```js
const normalized = value.normalize("NFC");
```

Preserve original user-entered names and addresses for display unless normalization is required.

Separate display formatting from stored canonical values.

## Testing Forms

Test native submission behavior.

Test validation success and failure.

Test required fields.

Test keyboard navigation.

Test screen reader labels and descriptions.

Test autofill and password manager behavior where practical.

Test mobile input keyboards.

Test server-side validation errors rendering back into the form.

Test repeated submissions.

Test network failure.

Test slow submissions.

Test file upload limits.

Test dynamic field add/remove behavior.

Test international data:

```text
accented names
single-word names
long names
non-Latin scripts
international phone numbers
postal codes with letters/spaces
right-to-left text
```

Test empty, malformed, boundary, and malicious input.

Use automated tests for serialization and validation logic.

Use browser tests for important user flows.

Manual accessibility testing is still important.

## Common Anti-Patterns

Using placeholders as labels.

Using `div` or `span` instead of real form controls.

Using `onclick` on non-buttons for submit actions.

Using `type="number"` for credit cards, ZIP codes, phone numbers, or IDs.

Disabling paste in password or OTP fields.

Hiding focus outlines.

Relying only on color for errors.

Showing vague error messages.

Clearing the whole form after a validation error.

Validating only on the client.

Trusting hidden fields.

Submitting sensitive data via GET.

Breaking password managers with fake fields.

Creating custom selects without keyboard support.

Replacing native date input with an inaccessible date picker.

Using `form.submit()` when `requestSubmit()` is intended.

Forgetting `name` attributes.

Forgetting `type="button"` on non-submit buttons.

Using positive `tabindex`.

Putting interactive elements inside labels in ways that create confusing activation behavior.

Overusing live regions.

Blocking IME input or non-English characters.

Using regexes that reject valid real-world names, emails, addresses, or phone numbers.

Making disabled text unreadable.

Not handling duplicate submissions.

Not preserving values after server errors.

## Recommended Baseline Patterns

A robust simple field:

```html
<div class="field">
  <label for="email">Email</label>
  <input
    id="email"
    name="email"
    type="email"
    autocomplete="email"
    required
    aria-describedby="email-error"
  >
  <p id="email-error" class="field-error"></p>
</div>
```

A robust form:

```html
<form method="post" action="/account" novalidate>
  <div class="field">
    <label for="display-name">Display name</label>
    <input
      id="display-name"
      name="displayName"
      autocomplete="name"
      required
      minlength="2"
      aria-describedby="display-name-error"
    >
    <p id="display-name-error" class="field-error"></p>
  </div>

  <div class="field">
    <label for="email">Email</label>
    <input
      id="email"
      name="email"
      type="email"
      autocomplete="email"
      required
      aria-describedby="email-error"
    >
    <p id="email-error" class="field-error"></p>
  </div>

  <p id="form-status" role="status"></p>

  <button type="submit">Save</button>
</form>
```

Basic validation enhancement:

```js
const form = document.querySelector("form");

function setError(input, message) {
  const error = document.getElementById(`${input.id}-error`);

  input.setCustomValidity(message);
  input.toggleAttribute("aria-invalid", Boolean(message));

  if (error) {
    error.textContent = message;
  }
}

function validateField(input) {
  setError(input, "");

  if (input.validity.valueMissing) {
    setError(input, "Complete this field.");
    return false;
  }

  if (input.validity.typeMismatch && input.type === "email") {
    setError(input, "Enter a valid email address.");
    return false;
  }

  if (input.validity.tooShort) {
    setError(input, `Use at least ${input.minLength} characters.`);
    return false;
  }

  return true;
}

form.addEventListener("input", (event) => {
  const input = event.target;

  if (!(input instanceof HTMLInputElement)) return;
  if (!input.hasAttribute("aria-invalid")) return;

  validateField(input);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const fields = form.querySelectorAll("input, select, textarea");
  const valid = [...fields].every(validateField);

  if (!valid || !form.reportValidity()) {
    return;
  }

  const submitter = event.submitter;
  submitter.disabled = true;

  try {
    const response = await fetch(form.action, {
      method: form.method,
      body: new FormData(form, submitter),
    });

    if (!response.ok) {
      throw new Error("Submission failed");
    }
  } finally {
    submitter.disabled = false;
  }
});
```

A non-JS-friendly async form should keep its `action` and `method` valid.

## Practical Defaults I Would Apply

Use semantic HTML form controls.

Use visible labels.

Use native validation attributes for straightforward constraints.

Use `FormData` for serialization.

Use `requestSubmit()` for programmatic submission.

Use `SubmitEvent.submitter` for multiple submit buttons.

Use `autocomplete` tokens.

Use `inputmode` for mobile keyboard hints.

Use `type="text"` instead of `type="number"` for numeric-looking identifiers.

Use `aria-describedby` for help and errors.

Use `aria-invalid` only when invalid.

Use server-side validation as authoritative.

Use progressive enhancement for async submission.

Use `AbortController` for canceling stale async work.

Use `:focus-visible`, `:focus-within`, `accent-color`, and `color-scheme`.

Use `:has()` when it simplifies styling and fallback is acceptable.

Use `fieldset` and `legend` for grouped options.

Use `button type="button"` for non-submit buttons.

Use `method="get"` for searches and filters.

Use `method="post"` for mutations.

Use `multipart/form-data` for uploads.

Use status regions for submit/save feedback.

Use error summaries for long forms.

Use real links for navigation and real buttons for actions.

Use clean separation between validation, rendering, and submission logic.

Preserve user input across errors.

Avoid custom controls unless the product need outweighs the accessibility and maintenance cost.
