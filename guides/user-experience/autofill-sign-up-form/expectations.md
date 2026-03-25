# Expectations: `autofill-sign-up-form`

- Custom form controls (UI components for data entry) built using JavaScript **MUST NOT** be used if they break the autofill experience. A custom form control built using JavaScript that uses hidden inputs **MUST** reflect the selected value as well as the `:autofill` state in its custom UI.
- `<input>`, `<select>`, and `<textarea>` elements **MUST** be within a `<form>` element.

- Every `<input>`, `<select>`, and `<textarea>` element **MUST** have an `autocomplete` attribute with a valid value that is appropriate for the data being entered in that form field.
- An `<input>` element used for entry of a user's personal name must have an `autocomplete` attribute, and the value of that `autocomplete` attribute must include the value `name`.
- An `<input>` element used for entry of a user's first name (also known as "given name") must have an `autocomplete` attribute, and the value of that `autocomplete` attribute must include the value `given-name`.
- An `<input>` element used for entry of a user's last name (also known as "family name") must have an `autocomplete` attribute, and the value of that `autocomplete` attribute must include the value `family-name`.
- An `<input>` element used for entry of a username must have an `autocomplete` attribute, and the value of that `autocomplete` attribute must include the value `username`.
- An `<input>` element used for entry of a telephone number must have an `autocomplete` attribute, and the value of that `autocomplete` attribute must include the value `tel`.
- An `<input>` element used for entry of an email address must have an `autocomplete` attribute, and the value of that `autocomplete` attribute must include the value `email`.
- An `<input>` element used for entry of a postal code (known in the United States as a ZIP code) must have an `autocomplete` attribute, and the value of that `autocomplete` attribute must include the value `postal-code`. In the United States, postal codes are known as a ZIP codes.

- An `<input>` element used for entry of a URL must have an `autocomplete` attribute, and the value of that `autocomplete` attribute must include the value `url`.
- An `<input>` element used for entry of an email address **MUST** include the attribute `type="email"`.
- An `<input>` element used for entry of a search query **MUST** include the attribute `type="search"`.
- An `<input>` element used for entry of an telephone number or a mobile number **MUST** include the attribute `type="tel"`.
- An `<input>` element used for entry of a URL **MUST** include the attribute `type="url"`.

- Every `<input>`, `<select>`, or `<textarea>` element in a form **MUST** have an `id` attribute and a `name` attribute with a non-empty value that is appropriate for the data being entered.
- `id` and `name` attributes **MUST** be unique to each element. `id` and `name` attributes **MUST NOT** be the same for multiple elements.
- The value of the `id` and `name` attributes of a form element **SHOULD** be the same.
- A `pattern` attribute **SHOULD** be provided when appropriate to validate data entry.
- Every `<input>`, `<select>`, or `<textarea>` element in a form **MUST** be visually labeled using a `<label>` element.
- Every `<label>` element **MUST** have a `for` attribute with a value that matches the `id` attribute value of an adjacent `<input>`, `<select>`, or `<textarea>` element element.
- The `type="number"` attribute **MUST NOT** be included in an `<input>` element used for entry of a number that is not meant to be incremented, such as a payment card number, date, postal code, one-time code (OTP), ID number, membership number, or telephone number.
- For an `<input>` element used for a number that is not meant to be incremented, do not include a `type` attribute, or include the attribute `type="text"`, which is the default.
- The attribute `inputmode="email"` **MUST** be included in an `<input>` element that is used for input of an email address.
- The attribute `inputmode="numeric"` **MUST** be included in an `<input>` element that is used for input of a number, such as a payment card number, date in numeric format, numeric-only postal code, one-time code (OTP), telephone number, membership number, or quantity.
- The attribute `inputmode="search"` **MUST** be included in an `<input>` element that is used for input of a search query.
- The attribute `inputmode="tel"` **MUST** be included in an `<input>` element that is used for input of a telephone number or a mobile number.
- The attribute `inputmode="url"` **MUST** be included in an `<input>` element that is used for input of a URL.
- To help browsers autofill forms, every `<input>` element **MUST** have a `name` and `id` attribute that is stable and does not change between page loads or website deployments.
- If separate data is not required for each of the different parts of a personal name, ask for personal names with a single `<input>`. Do not assume that all users have a first name and a last name. If separate data is required for the parts of a user's name, use `<input>` elements with the following format: for first name (also known as given name) `<input name="given-name" id="given-name" type="text" autocomplete="given-name">`, for family name (also known as "last name") `<input name="family-name" id="family-name" type="text" autocomplete="family-name">`. "last name" is a synonym of "family name" and "second name". "given name" is a synonym of "first name". Use the label "First name" for an `<input>` element that has the attribute `autocomplete="given-name"`.
- Unless specified as a requirement, **DO NOT** include a separate form field for the user's title (i.e. an honorific prefix such as Ms, Miss, Mr, or Dr), since this may not work with autofill. If there _is_ a requirement to get a user's title, use an `<input>` element with the following format: `<input name="honorific-prefix" id="honorific-prefix" type="text" autocomplete="honorific-prefix">`. "title" (for example, Ms, Miss, Mr, Dr) is a synonym of "honorific prefix". Use the label "Title" for an `<input>` element that has the attribute `autocomplete="honorific-prefix"`.
- **DO NOT** enforce Latin-only characters for names and usernames.
- An `<input>`, `<select>`, or `<textarea>` element **MUST** have a `required` attribute if it is mandatory for the user to provide a value for that form field.
- An `<input>` element used for password entry **MUST** have `aria-label` and `aria-describedby` attributes.
- `autocomplete="new-password"` and `id="new-password"` attributes **MUST** be included in an `<input>` element used for entry of a new password in a sign-up form, or for the new password in a change-password form.
- Do not double-up form fields for passwords or email addresses: do not make the user enter passwords and email addresses twice. Instead, ensure that users confirm their email address, and make it easy for users to reset their password if necessary.
- An `<input>` element used for password entry **MUST** have a `type="password"` attribute.
- The `type="password"`attribute **MUST** only be included on `<input>` elements used for password entry. The `type="password"`attribute **MUST NOT** be used on other types of form fields, such as for an OTP (one-time password) or a credit card security code.
- The `type="email"` attribute **MUST** be included in an `<input>` element used for email entry, to ensure mobile users are provided with an appropriate keyboard.
- For forms, use well-known and easily understood names such as "Sign In", "Create Account", "Register".
- For form fields, use well-known and easily understood label values such as "Name", "Email", "Telephone", and "Password".
