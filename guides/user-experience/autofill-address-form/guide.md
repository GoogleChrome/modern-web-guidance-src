---
name: autofill-address-form
description: Build an address form that follows best practice, and works correctly with browser autofill features.
web-feature-ids:
  - autofill
sources:
  - https://web.dev/articles/payment-and-address-form-best-practices
  - https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete
  - https://developer.mozilla.org/docs/Web/HTML/Element/form
  - https://developer.mozilla.org/docs/Web/HTML/Element/input
  - https://developer.mozilla.org/docs/Web/HTML/Element/label
  - https://www.columbia.edu/~fdc/postal/
---

# Build an address form that follows best practice

Create a form that makes it as easy as possible for users to enter address data on desktop and
mobile. Ensure the form makes the most of built-in browser features for autofill, validation and
data entry constraints.

## How to implement

Outlined below are the most important guidelines for building successful address forms.

### Use meaningful, valid HTML

Make the most of the elements and attributes built for creating forms:

-   `<form>`, `<input>`, `<label>`, and `<button>`
-   `type`, `autocomplete`, and `inputmode`

These enable built-in browser functionality, improve accessibility, and add meaning to markup.

### Use the <label> element to label form fields for data entry

To label an `<input>`, `<select>`, or `<textarea>`, use a `[<label>]
(https://developer.mozilla.org/docs/Web/HTML/Element/label)`.\ Associate a label with an input by
giving the label's `for` attribute the same value as the input's `id`.

### Make the most of HTML attributes

Make it easy for users to enter data, by using the appropriate `<input>` element `<type>` attribute
to provide the right keyboard on mobile and enable basic built-in validation by the browser.

Always use `type="email"` for email addresses and `type="tel"` for phone numbers.

Every `<input>`, `<select`, and `<textarea>` element should have an appropriate `autocomplete`
attribute, to improve accessibility and help users avoid re-entering data.

### Make buttons helpful

Use `<button>` for buttons. You can also use `<input type="submit">`, but don't use a `div` or some
other random element acting as a button. Button elements provide accessible behaviour, built-in
form submission functionality, and can easily be styled.

Give each form submit button a value that says what it does. For each step towards checkout, use a
descriptive call-to-action that shows progress and makes the next step obvious. For example, label
the submit button on your delivery address form **Proceed to Payment** rather than **Continue**
or **Save**.

### Use a single name input where possible

Allow your users to enter their name using a single input, unless you have a good reason for
separately storing given names, family names, honorifics, or other name parts. Using a single name
input makes forms less complex, enables cut-and-paste, and makes autofill simpler.

Allow international names. For validation, avoid using regular expressions that only match Latin
characters. Latin-only excludes users with names or addresses that include characters that aren't
in the Latin alphabet. Allow Unicode letter matching instead—and ensure your backend supports
Unicode securely as both input and output. Unicode in regular expressions is well supported by
modern browsers.

### Allow for a variety of address formats

When building an address form, be aware of the variety of address formats, even within a single
country. Do not make assumptions about "normal" addresses.

If possible within your data requirements, consider using a single `<textarea>` element for address.
This is the most flexible option for a variety of local and international address formats.

### Help save users from accidentally missing data fields

Add the `required` attribute to both email and password fields. Modern browsers automatically prompt and set focus for missing data.
