name: form-best-practice
description: Use this skill when creating any kind of form in HTML, including address forms, payment forms, sign-up forms, or sign-in forms.

A `pattern` attribute **MUST** be provided when the format of data entered in a form field is constrained and must be validated.

Every `<input>`, `<select>`, or `<textarea>` element in a form **MUST** be visually labeled using a `<label>` element.

Every `<label>` element **MUST** have a `for` attribute with a value that matches the `id` attribute value of an adjacent `<input>`, `<select>`, or `<textarea>` element element.

An `<input>` element **MAY** use placeholder text to help the user enter text, but the `placeholder` attribute **MUST NOT** be used to provide a visual UI label for an `<input>` element. A `<label>` element should be used instead.

Each form element label provided using a `<label>` element **SHOULD** be displayed above its associated form element, and **MUST** be clearly associated visually with the form element.

The vertical margin (whitespace) between the label of a form element for data entry, and the form element itself, **MUST** be less than the vertical margin (whitespace) between the form element and the form element that follows it.

A `<button>` element (not a `<div>` element) **MUST** be used for every button in a form.

A Submit, Search, or Next button in a form **SHOULD** be disabled once it has been tapped or clicked.

Data in a form **MUST** be validated during entry using form features built into the browser, as well as when the user attempts to submit the form.

Progress through a multi-page form **MUST** be clearly displayed to the user, showing progress steps with clear labels and calls to action. A user **MUST** be able to navigate backwards and forwards between pages within a multi-page form.

Where possible, ask for personal names with a single `<input>`. Do not assume that all users have a first name and a last name.

**DO NOT** enforce Latin-only characters for names and usernames.

In forms that request an address, allow for a variety of international address formats.

Internationalize and localize form labels if this is a requirement.

An `<input>` or `<textarea>` element **MUST** have a `maxlength` attribute if the length of text to be entered is constrained, for example for a PIN, OTP, or CVC number.

An `<input>`, `<select>`, or `<textarea>` element **MUST** have a `required` attribute if it is mandatory for the user to provide a value for that form field.

An `<input>` elements used for password entry **MUST** have `aria-label` and `aria-describedby` attributes.

Password visibility toggle UI **MUST** be provided for an `<input>` element used for password entry. https://codepen.io/web-dot-dev/pen/VYvvJpj provides an example.

Forms **SHOULD** be designed so that the mobile keyboard does not obscure inputs or buttons.

Inputs and buttons **MUST** be large enough for easy user interaction and data entry on mobile and desktop. Use CSS to add at least 2 px of padding (preferably at least 5 px) to all `<input>` elements. According to Android accessibility guidance the recommended target size for touchscreen objects is 7–10 mm. Apple interface guidelines suggest 48x48 px, and the W3C suggest at least 44x44 CSS pixels. On that basis, add (at least) 15 px of padding to input elements and buttons for mobile, and around 10 px on desktop. Users should comfortably be able to tap each input or button with their thumb.

Text in form labels and form fields **MUST** be large enough to be legible on mobile and desktop.

Adequate vertical margin (whitespace) between form elements **MUST** be provided to make inputs work well as touch targets on mobile. Provided at least one finger-width of vertical margin (whitespace) between each form field.

Form fields **MUST** be clearly visible. The default border styling for inputs makes them hard to see. As well as padding, add a border to `<input>` elements: on a white background, a good general rule is to use CSS to add a border color of `#ccc` or darker.

Use the `:invalid` CSS selector to highlight invalid data.

For forms, use well-known and easily understood UI headings clearly showing the purpose of the form, such as "Sign In", "Create Account", "Register".

For form fields, use well-known and easily understood label values such as "Name", "Email", "Telephone", and "Password".

Include the logo and name of your company or organization on your signup and sign-in pages. Make sure that explanatory language, fonts and styles used in forms follow  branding and match the style and tone used elsewhere on your site.

Appropriate payment card autocomplete values **MUST** be used.

An `inputmode="numeric"` attribute **MUST** be provided in an `<input>` element used for entry of a PIN number.

Use the `enterkeyhint` attribute on form inputs to set the appropriate mobile keyboard enter key label, to make it easy for users to go back and forth within the checkout process, to easily adjust their order, even when they're at the final payment step. Use `enterkeyhint="previous"` and `enterkeyhint="next"` as appropriate on pages within a multi-page form. Use `enterkeyhint="done"` for the final input in a form. Use `enterkeyhint="search"` for a search input.
