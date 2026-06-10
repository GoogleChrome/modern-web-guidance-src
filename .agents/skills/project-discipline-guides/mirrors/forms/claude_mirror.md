# Forms Development: Common Knowledge Guide

## 1. Semantic HTML Foundation

### The `<form>` Element

Always wrap form controls in a `<form>` element, even for single-input forms or JS-driven submissions. This enables implicit submission (Enter key), browser autofill heuristics, and assistive technology recognition.

```html
<form action="/submit" method="post" novalidate>
  <!-- controls -->
</form>
```

**Attributes:**
- `action` — submission URL
- `method` — `get` (default) or `post`
- `enctype` — `application/x-www-form-urlencoded` (default), `multipart/form-data` (for file uploads), or `text/plain`
- `novalidate` — disables native browser validation (use when implementing custom validation)
- `autocomplete` — `on` (default) or `off`
- `target` — `_self`, `_blank`, etc.
- `name` — identifies the form

### Always Pair Inputs with Labels

Every form control must have an associated label. Two valid patterns:

```html
<!-- Explicit association -->
<label for="email">Email</label>
<input type="email" id="email" name="email">

<!-- Implicit association (wrapping) -->
<label>
  Email
  <input type="email" name="email">
</label>
```

Prefer explicit `for`/`id` association — it works in more contexts and is more reliable with assistive tech.

**Never** substitute `placeholder` for a label. Placeholders disappear on input, fail contrast requirements, and are not announced consistently by screen readers.

### Fieldsets and Legends

Group related controls — especially radio buttons and checkboxes — with `<fieldset>` and `<legend>`:

```html
<fieldset>
  <legend>Shipping speed</legend>
  <label><input type="radio" name="speed" value="standard"> Standard</label>
  <label><input type="radio" name="speed" value="express"> Express</label>
</fieldset>
```

## 2. Input Types

Use the most specific input type available — browsers provide tailored UI, virtual keyboards, and validation:

| Type | Use case |
|------|----------|
| `text` | Generic single-line text |
| `email` | Email addresses (validates format) |
| `tel` | Phone numbers (numeric keyboard on mobile) |
| `url` | URLs (validates format) |
| `number` | Numeric input with spinner |
| `password` | Masked input |
| `search` | Search field (clear button on some platforms) |
| `date`, `time`, `datetime-local`, `month`, `week` | Date/time pickers |
| `color` | Color picker |
| `range` | Slider |
| `file` | File upload |
| `checkbox` | Boolean toggle |
| `radio` | Mutually exclusive choice |
| `hidden` | Form data not shown to user |

### Type-Specific Attributes

```html
<input type="number" min="0" max="100" step="0.01" inputmode="decimal">
<input type="text" minlength="3" maxlength="20" pattern="[a-z0-9]+">
<input type="file" accept="image/*" multiple capture="environment">
<input type="email" multiple>
<input type="date" min="2024-01-01" max="2030-12-31">
```

## 3. Critical Attributes

### `name` Attribute

Required for the control's value to be included in form submission. Without `name`, the field is excluded.

### `autocomplete` — Use Specific Tokens

Provide accurate `autocomplete` values for autofill and password managers. Never use `autocomplete="off"` for personal info — it's often ignored and harms UX.

```html
<input type="text" autocomplete="given-name">
<input type="text" autocomplete="family-name">
<input type="email" autocomplete="email">
<input type="tel" autocomplete="tel">
<input type="text" autocomplete="street-address">
<input type="text" autocomplete="postal-code">
<input type="text" autocomplete="cc-number">
<input type="text" autocomplete="cc-exp">
<input type="password" autocomplete="current-password">
<input type="password" autocomplete="new-password">
<input type="text" autocomplete="one-time-code">
```

For section grouping: `autocomplete="section-shipping street-address"`.

### `inputmode` — Virtual Keyboard Hint

Independent of `type`, controls the on-screen keyboard:

```html
<input type="text" inputmode="numeric" pattern="[0-9]*">
<input type="text" inputmode="decimal">
<input type="text" inputmode="email">
<input type="text" inputmode="tel">
<input type="text" inputmode="url">
<input type="search" inputmode="search">
```

### `enterkeyhint` — Enter Key Label

```html
<input enterkeyhint="search">
<input enterkeyhint="send">
<input enterkeyhint="done">
<input enterkeyhint="next">
<input enterkeyhint="go">
```

### `required`, `disabled`, `readonly`

- `required` — must have a value to submit
- `disabled` — not focusable, not submitted, greyed out
- `readonly` — focusable, value submitted, not editable

Disabled fields are excluded from submission. Use `readonly` if you need the value in the payload.

## 4. Native Validation

### Constraint Validation Attributes

```html
<input required>
<input minlength="8" maxlength="100">
<input min="0" max="100" step="1">
<input pattern="[A-Za-z0-9]+" title="Alphanumeric only">
<input type="email"> <!-- format validation -->
<input type="url">   <!-- format validation -->
```

### The Constraint Validation API

```js
input.checkValidity();      // boolean
input.reportValidity();     // boolean + shows native UI
input.validity;             // ValidityState object
input.validationMessage;    // localized message
input.setCustomValidity(''); // set custom error or clear

// ValidityState properties
input.validity.valueMissing;
input.validity.typeMismatch;
input.validity.patternMismatch;
input.validity.tooLong;
input.validity.tooShort;
input.validity.rangeUnderflow;
input.validity.rangeOverflow;
input.validity.stepMismatch;
input.validity.badInput;
input.validity.customError;
input.validity.valid;
```

### `:invalid`, `:valid`, `:user-invalid`, `:user-valid`

Prefer `:user-invalid` / `:user-valid` over `:invalid` / `:valid` — they only apply after the user has interacted with the field, avoiding the "everything is red on page load" anti-pattern. Now supported in all modern browsers.

```css
input:user-invalid {
  border-color: red;
}
input:user-valid {
  border-color: green;
}
```

### Custom Validation Pattern

```js
form.addEventListener('submit', (e) => {
  if (!form.checkValidity()) {
    e.preventDefault();
    // surface errors
  }
});

input.addEventListener('input', () => {
  if (input.value === 'reserved') {
    input.setCustomValidity('That value is reserved.');
  } else {
    input.setCustomValidity('');
  }
});
```

Always disable native UI with `novalidate` on the form when implementing custom error messaging, but still call `checkValidity()` to leverage the API.

## 5. Accessibility

### Error Messaging

Associate error messages with inputs via `aria-describedby` and mark invalid inputs with `aria-invalid`:

```html
<label for="email">Email</label>
<input
  type="email"
  id="email"
  name="email"
  aria-invalid="true"
  aria-describedby="email-error">
<p id="email-error" role="alert">Please enter a valid email address.</p>
```

For dynamic error announcement, use `role="alert"` or a live region (`aria-live="polite"`).

### Required Fields

The `required` attribute implicitly conveys required state. To add a visual indicator (e.g., asterisk), ensure it's also conveyed:

```html
<label for="name">Name <span aria-hidden="true">*</span></label>
<input id="name" name="name" required aria-required="true">
```

`aria-required="true"` is redundant with `required` but harmless.

### Focus Management

- On submit error, move focus to the first invalid field.
- After successful submission, move focus to the success message or the next logical control.
- Never trap focus inside a form.

### Hidden Labels

If a visible label isn't possible, use `aria-label` or `aria-labelledby` — but always prefer a visible label.

```html
<input type="search" aria-label="Search products">
```

### Touch Targets

Interactive controls should have a minimum touch target of 44×44 CSS pixels (WCAG 2.5.5).

### Color Contrast

Form labels, placeholder text, error messages, and borders must meet WCAG AA contrast: 4.5:1 for text, 3:1 for UI components.

## 6. Layout and Styling

### Native Control Styling

Modern CSS allows extensive customization of form controls:

```css
/* Reset native appearance */
input, button, select, textarea {
  appearance: none;
  -webkit-appearance: none;
  font: inherit;
  color: inherit;
}

/* Custom checkbox/radio with accent-color (cross-browser) */
input[type="checkbox"], input[type="radio"] {
  accent-color: rebeccapurple;
}

/* Caret color */
input { caret-color: hotpink; }

/* Selection color in inputs */
input::selection { background: yellow; }
```

### Pseudo-elements

```css
input::placeholder { color: #888; }
input::file-selector-button { /* style file input button */ }
input[type="search"]::-webkit-search-cancel-button { display: none; }
```

### Field Sizing (Modern)

```css
textarea {
  field-sizing: content; /* Auto-grows with content - Chromium */
}
```

### Form Layout

Use CSS Grid or Flexbox for form layout. A common pattern:

```css
form {
  display: grid;
  gap: 1rem;
}

.field {
  display: grid;
  gap: 0.25rem;
}
```

### `<dialog>` for Modal Forms

```html
<dialog id="confirm">
  <form method="dialog">
    <p>Are you sure?</p>
    <button value="cancel">Cancel</button>
    <button value="confirm">Confirm</button>
  </form>
</dialog>
```

`<form method="dialog">` closes the dialog on submit and exposes the clicked button's value via `dialog.returnValue`.

## 7. Buttons

### Always Specify `type`

Default `<button>` type inside a `<form>` is `submit`. Explicitly set `type="button"` for non-submitting buttons to prevent surprise submissions:

```html
<button type="submit">Save</button>
<button type="button" onclick="...">Cancel</button>
<button type="reset">Reset</button>
```

### Multiple Submit Buttons

Use `name` and `value` to distinguish:

```html
<button type="submit" name="action" value="save">Save</button>
<button type="submit" name="action" value="publish">Publish</button>
```

Or `formaction`/`formmethod` for per-button overrides.

### Button vs. Link

- `<button>` triggers an action
- `<a>` navigates to a URL

Don't style a `<div>` as a button — use the right element. If you must, add `role="button"`, `tabindex="0"`, and keyboard handlers, but don't.

## 8. Form Submission

### `FormData` API

```js
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(form);

  // Iterate
  for (const [key, value] of formData) { /* ... */ }

  // Convert to plain object (loses multi-value fields)
  const data = Object.fromEntries(formData);

  // Submit as multipart
  await fetch('/api', { method: 'POST', body: formData });

  // Submit as JSON
  await fetch('/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(formData)),
  });

  // Submit as URL-encoded
  await fetch('/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(formData),
  });
});
```

### `FormData` for File Uploads

```js
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('description', 'My file');
// Don't set Content-Type — browser sets it with the boundary
await fetch('/upload', { method: 'POST', body: formData });
```

### Form Events

- `submit` — fires on submission attempt; cancel with `preventDefault()`
- `formdata` — fires after `submit`, allows mutating the `FormData`
- `reset` — fires when the form is reset
- `input` — fires on every value change
- `change` — fires when value commits (blur for text inputs)
- `invalid` — fires on a control when validation fails

### Idempotent Submissions

Disable the submit button (or show a spinner) during submission to prevent double-submits:

```js
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = form.querySelector('[type="submit"]');
  submitBtn.disabled = true;
  try {
    await submit(new FormData(form));
  } finally {
    submitBtn.disabled = false;
  }
});
```

## 9. Security

### Always Validate Server-Side

Client-side validation is for UX only. Re-validate every input on the server. Never trust:
- `disabled` (can be removed in DevTools)
- `maxlength` (can be bypassed)
- `pattern` (can be bypassed)
- Hidden field values (visible and editable)
- File `accept` (file type must be checked server-side)

### CSRF Protection

For state-changing requests with cookie-based auth, include a CSRF token:

```html
<input type="hidden" name="csrf_token" value="...">
```

Or use `SameSite=Strict`/`Lax` cookies.

### Input Sanitization

- Never `innerHTML` user input — use `textContent` or `Element.setHTML()` (Sanitizer API).
- Use parameterized queries server-side; never string-concatenate SQL.
- Escape output appropriate to context (HTML, JS, URL, CSS).

### Password Fields

```html
<input
  type="password"
  autocomplete="new-password"
  minlength="12"
  required>
```

- `new-password` for sign-up/change-password — triggers password manager generation
- `current-password` for login
- Don't enforce arbitrary complexity rules; long passphrases beat complex short ones (NIST guidance)
- Allow paste — disabling it breaks password managers

### One-Time Codes

```html
<input
  type="text"
  inputmode="numeric"
  autocomplete="one-time-code"
  pattern="[0-9]{6}"
  maxlength="6">
```

iOS/Android will surface SMS codes for autofill.

### Sensitive Inputs

- `autocomplete="off"` for credit card CVC
- Use HTTPS — never submit credentials over HTTP
- Consider `Content-Security-Policy` to limit script sources

## 10. Modern APIs and Features

### `<form>` Association for Custom Elements

Custom elements can participate in forms via `ElementInternals`:

```js
class MyInput extends HTMLElement {
  static formAssociated = true;
  #internals = this.attachInternals();
  setValue(v) { this.#internals.setFormValue(v); }
  setValidity(...args) { this.#internals.setValidity(...args); }
}
```

### `formAction` / `formMethod` / `formTarget` / `formEnctype` / `formNoValidate`

Per-button overrides of the parent form's attributes.

### `requestSubmit()`

Programmatically submit a form **with** validation (unlike `.submit()`):

```js
form.requestSubmit();
form.requestSubmit(submitButton); // Simulates clicking that button
```

### `URLSearchParams`

```js
const params = new URLSearchParams(window.location.search);
params.get('q');
params.set('page', '2');
history.pushState(null, '', '?' + params);
```

### `submitter` on the Submit Event

Identifies which button triggered submission:

```js
form.addEventListener('submit', (e) => {
  console.log(e.submitter); // The clicked button
});
```

## 11. UX Best Practices

### Field Order

Match the user's mental model — for addresses, follow local convention. For sign-up, ask for the minimum needed.

### Error Display

- Inline errors next to the relevant field
- Show errors on blur (or after submit attempt), not on every keystroke
- Use clear, actionable language: "Enter a valid email address" not "Invalid input"
- Don't clear field values on validation error
- Summarize errors at the top of long forms with anchors to fields

### Progressive Disclosure

Reveal additional fields conditionally rather than overwhelming users upfront.

### Save Progress

For long forms, save drafts to `localStorage` so users don't lose data:

```js
input.addEventListener('input', () => {
  localStorage.setItem(`form:${input.name}`, input.value);
});
```

Clear on successful submit.

### Loading States

Show explicit loading state during async operations. Disable submit, show a spinner, announce status with `aria-live`.

### Confirmation

After successful submit, show clear confirmation. For destructive actions, require confirmation before submission (`<dialog>` works well).

### Avoid Modal Form Anti-patterns

- Don't auto-advance on input (jarring, breaks paste)
- Don't split phone/SSN/credit-card across multiple inputs unless paste is handled (use `inputmode` and let users paste a full string)
- Don't strip formatting characters silently
- Don't truncate without warning

## 12. Common Patterns

### Toggle Password Visibility

```html
<div class="password-field">
  <input type="password" id="pw" name="pw">
  <button type="button" aria-pressed="false" aria-label="Show password">👁</button>
</div>
```

```js
btn.addEventListener('click', () => {
  const isShown = btn.getAttribute('aria-pressed') === 'true';
  btn.setAttribute('aria-pressed', String(!isShown));
  pw.type = isShown ? 'password' : 'text';
});
```

### Character Counter

```html
<textarea id="bio" maxlength="280" aria-describedby="bio-count"></textarea>
<p id="bio-count" aria-live="polite">280 characters remaining</p>
```

### Combobox / Autocomplete

Use `<input list="...">` with `<datalist>` for simple cases (free text + suggestions):

```html
<input list="cities" name="city">
<datalist id="cities">
  <option value="Berlin">
  <option value="Boston">
</datalist>
```

For richer comboboxes, use the ARIA combobox pattern (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`).

### Multi-Step Forms

- One logical group per step
- Show progress (`aria-valuenow` on a progressbar, or a stepper)
- Allow back navigation without losing state
- Validate per step on "next"

## 13. Clean Code Principles

### Single Source of Truth

Don't duplicate validation logic in HTML attributes and JS. Prefer reading from the DOM (`input.validity`) or define rules in one place.

### Avoid Deeply Nested Conditionals

Validation logic should be flat and readable:

```js
// Prefer
if (!input.value) return setError('Required');
if (input.value.length < 8) return setError('Too short');

// Over nested if/else trees
```

### Extract Reusable Logic

Validation, error display, and submission logic that repeat across forms belong in shared functions or custom elements.

### Naming

- `name` attributes match the server's expected field names
- `id` values are unique per page
- Use `kebab-case` for HTML, `camelCase` for JS, snake_case for backend conventions

### Don't Reinvent Native Behavior

Native form controls are accessible, internationalized, and keyboard-navigable for free. Wrap before you replace. If you must build a custom control:
- Match keyboard expectations (Space activates checkboxes, Arrow keys navigate radios, etc.)
- Implement focus management
- Support form participation via `ElementInternals`
- Test with screen readers

### Progressive Enhancement

Forms should work without JavaScript when feasible:
- `<form action>` should point to a working endpoint
- JS enhances the submission (no page reload, better errors) but isn't required
- This is also a resilience pattern — JS can fail to load

### Accessibility is Not Optional

Test with keyboard only (Tab, Shift+Tab, Enter, Space, Arrow keys). Test with a screen reader (VoiceOver, NVDA, JAWS, TalkBack). Run automated tools (axe, Lighthouse) but don't rely on them exclusively.

### Internationalization

- Use `inputmode` for keyboard, not assumptions about character sets
- Support locale-specific date/number/address formats
- Don't constrain names to ASCII or specific length
- Allow international phone numbers (`type="tel"` is intentionally unstructured)
- Email validation: be permissive — emails like `user+tag@subdomain.example.museum` are valid
