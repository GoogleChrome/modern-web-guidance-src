---
name: autofill-sign-up-form
description: Build a sign-up form with correct autocomplete values and autofill support.
web-feature-ids:
  - input-email-tel-url
  - inputmode
sources:
  - https://web.dev/articles/sign-up-form-best-practices
---

# Build a sign-up form that follows best practice

Use cross-platform browser features to build sign-up forms that are secure, accessible and easy to use.

If users ever need to sign up to your site, then good sign-up form design is critical. This is especially true for people on poor connections, on mobile, in a hurry, or under stress. Poorly designed sign-up forms get high bounce rates. Each bounce could mean a lost customer and a disgruntled user—not just a missed sign-up opportunity.

## How to implement

Outlined below are the most important guidelines for building successful sign-up forms.

{{ INCLUDE("features/forms.md#forms-markup-best-practices") }}

### Make the most of HTML attributes

{{ INCLUDE("features/forms.md#forms-html-attributes-intro") }}

{{ INCLUDE("features/forms.md#forms-html-attributes-conclusion") }}

### Make buttons helpful

{{ INCLUDE("features/forms.md#forms-button-element") }}

Give each form submit button a value that says what it does. Use a clear, recognizable label. For example, use **Create account** or **Sign up** rather than **Continue** or **Submit**.

### Use a single name input where possible

{{ INCLUDE("features/forms.md#forms-single-name") }}

### Show sign-up progress

For each step towards sign-up, use page headings and descriptive button values that make it clear what needs to be done now, and what the next step is.

{{ INCLUDE("features/forms.md#forms-enterkeyhint") }}

### Help users avoid re-entering sign-up data

Make sure to add appropriate `autocomplete` values in sign-up forms.

This enables browsers to help users by securely storing sign-up details and correctly entering form data. Without autocomplete, users may be more likely to keep a physical record of sign-up details, or store sign-up data insecurely on their device.

### Validate carefully

Validate data entry both in realtime and before form submission. Use `type="email"` for email inputs — the browser will validate the format automatically. For passwords, use a `pattern` attribute to enforce strength requirements and provide clear error messages when validation fails. Add the `required` attribute to mandatory fields to prevent empty submissions.

{{ INCLUDE("features/auth-forms.md#auth-registration-practices") }}

### Prevent mobile keyboard from obstructing the Sign up button

If you're not careful, mobile keyboards may cover your form or, worse, partially obstruct the Sign up button. Users may give up before realizing what has happened.

Where possible, avoid this by displaying only the email (or phone) and password inputs and Sign up button at the top of your sign-up page. Put other content underneath.

### Help users to avoid re-entering data

{{ INCLUDE("features/auth-forms.md#auth-avoid-re-entering") }}

### Use autocomplete="new-password" and id="new-password" for a new password

MANDATORY: For a sign-up form, use `autocomplete="new-password"`.

```html
<!-- new-password prevents password managers from auto-filling an existing password into this field -->
<input type="password" id="new-password" name="new-password" autocomplete="new-password" required>
```

### Enable the browser to suggest a strong password

Modern browsers use heuristics to decide when to show the password manager UI and suggest a strong password.

Built-in browser password generators mean users and developers don't need to work out what a "strong password" is. Since browsers can securely store passwords and autofill them as necessary, there's no need for users to remember or enter passwords. Encouraging users to take advantage of built-in browser password generators also means they're more likely to use a unique, strong password on your site, and less likely to reuse a password that could be compromised elsewhere.

### Help save users from accidentally missing inputs

Add the `required` attribute to both email and password fields. Modern browsers automatically prompt and set focus for missing data.

### Allow password pasting

{{ INCLUDE("features/auth-forms.md#auth-allow-password-pasting") }}

### Offer third-party login

Many users prefer to sign in to websites using an email address and password sign-up form. However, you should also enable users to sign in using a third-party identity provider, also known as federated login.

This approach has several advantages. For users who create an account using federated login, you don't need to ask for, communicate, or store passwords.

You may also be able to access additional verified profile information from federated login, such as an email address—which means the user doesn't have to enter that data and you don't need to do the verification yourself. Federated login can also make it much easier for users when they get a new device.

### Take care with usernames

Don't insist on a username unless (or until) you need one. Enable users to sign up and sign in with only an email address (or telephone number) and password—or federated login if they prefer. Don't force them to choose and remember a username.

If your site does require usernames, don't impose unreasonable rules on them, and don't stop users from updating their username. On your backend you should generate a unique ID for every user account, not an identifier based on personal data such as username.

Also make sure to use `autocomplete="username"` for usernames.

### Fallback strategies

{{ BASELINE_STATUS("input-email-tel-url") }}
{{ BASELINE_STATUS("inputmode") }}

Autofill is a progressive enhancement. In browsers that do not support autofill, users will simply need to manually enter their sign-up credentials. The semantic HTML constraints (such as `type`, `inputmode`, and `required`) will still function appropriately to validate user input and provide the correct virtual keyboards.
