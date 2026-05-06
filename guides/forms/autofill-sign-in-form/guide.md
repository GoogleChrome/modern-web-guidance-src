---
name: autofill-sign-in-form
description: Build a sign-in form with correct autocomplete values and autofill support.
web-feature-ids:
  - input-email-tel-url
  - inputmode
sources:
  - https://web.dev/articles/sign-in-form-best-practices
---

# Build a sign-in form that follows best practice

Use cross-platform browser features to build sign-in forms that are secure, accessible and easy to use.

If users ever need to sign in to your site, then good sign-in form design is critical. This is especially true for people on poor connections, on mobile, in a hurry, or under stress. Poorly designed sign-in forms get high bounce rates. Each bounce could mean a lost customer and a disgruntled user—not just a missed sign-in opportunity.

## How to implement

Outlined below are the most important guidelines for building successful sign-in forms.

### Use meaningful, valid HTML

{{ INCLUDE("features/forms.md#forms-meaningful-html") }}

### Use the <label> element to label form fields for data entry

{{ INCLUDE("features/forms.md#forms-label-element") }}

### Make the most of HTML attributes

{{ INCLUDE("features/forms.md#forms-html-attributes-intro") }}

{{ INCLUDE("features/forms.md#forms-html-attributes-conclusion") }}

### Make buttons helpful

{{ INCLUDE("features/forms.md#forms-button-element") }}

Give each form submit button a value that says what it does. Use a clear, recognizable label. For example, use **Sign In** rather than **Continue** or **Submit**.

### Use a single name input where possible

{{ INCLUDE("features/forms.md#forms-single-name") }}

### Show sign-in progress

For each step towards sign-in, use page headings and descriptive button values that make it clear what needs to be done now, and what the next step is.

{{ INCLUDE("features/forms.md#forms-enterkeyhint") }}

### Help users avoid re-entering sign-in data

Make sure to add appropriate `autocomplete` values in sign-in forms.

This enables browsers to help users by securely storing sign-in details and correctly entering form data. Without autocomplete, users may be more likely to keep a physical record of sign-in details, or store sign-in data insecurely on their device.

### Validate carefully

Validate data entry both in realtime and before form submission. Use `type="email"` for email inputs — the browser will validate the format automatically. Add the `required` attribute to mandatory fields to prevent empty submissions.

### Put sign-in in its own <form> element

{{ INCLUDE("features/auth-forms.md#auth-own-form") }}

### Keep passwords private—but enable users to see them if they want

{{ INCLUDE("features/auth-forms.md#auth-keep-passwords-private") }}

### Give mobile users the right keyboard

{{ INCLUDE("features/auth-forms.md#auth-mobile-keyboard") }}

### Prevent mobile keyboard from obstructing the Sign in button

If you're not careful, mobile keyboards may cover your form or, worse, partially obstruct the Sign in button. Users may give up before realizing what has happened.

Where possible, avoid this by displaying only the email (or phone) and password inputs and Sign in button at the top of your sign-in page. Put other content underneath.

### Help users to avoid re-entering data

{{ INCLUDE("features/auth-forms.md#auth-avoid-re-entering") }}

### Use autocomplete="current-password" and id="current-password" for an existing password

MANDATORY: Use `autocomplete="current-password"` and `id="current-password"` for the password input in a sign-in form. This tells the browser that you want it to use the current password that it has stored for the site.

For a sign-in form:

```html
<input type="password" autocomplete="current-password" id="current-password" required>
```

### Help save users from accidentally missing inputs

MANDATORY: Add the `required` attribute to both email and password fields. Modern browsers automatically prompt and set focus for missing data.

```html
<input type="email" id="email" name="email" autocomplete="username webauthn" required>
<input type="password" id="password" name="password" autocomplete="current-password" required>
```

### Allow password pasting

{{ INCLUDE("features/auth-forms.md#auth-allow-password-pasting") }}

### Fallback strategies

{{ BASELINE_STATUS("input-email-tel-url") }}
{{ BASELINE_STATUS("inputmode") }}

Autofill is a progressive enhancement. In browsers that do not support autofill, users will simply need to manually enter their sign-in credentials. The semantic HTML constraints (such as `type`, `inputmode`, and `required`) will still function appropriately to validate user input and provide the correct virtual keyboards.
