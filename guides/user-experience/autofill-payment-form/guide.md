---
name: autofill-payment-form
description: Build a payment form that follows best practice, and works correctly with browser autofill features.
web-feature-ids:
  - autofill
sources:
  - https://web.dev/articles/payment-and-address-form-best-practices
  - https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete
  - https://developer.mozilla.org/docs/Web/HTML/Element/form
  - https://developer.mozilla.org/docs/Web/HTML/Element/input
  - https://developer.mozilla.org/docs/Web/HTML/Element/label
---

# Build a payment form that follows best practice

Payment forms are the single most critical part of the checkout process. Poor
payment form design is a common cause of shopping cart abandonment.

Create a form that makes it as easy as possible for users to enter payment
details on desktop and mobile. Ensure the form makes the most of built-in
browser features for autofill, validation and data entry constraints.

## How to implement

Outlined below are the most important guidelines for building successful payment
forms.

### Use meaningful, valid HTML

Make the most of the elements and attributes built for creating forms:

-   `<form>`, `<input>`, `<label>`, and `<button>`
-   `type`, `autocomplete`, and `inputmode`

These enable built-in browser functionality, improve accessibility, and add
meaning to markup.

### Use the <label> element to label form fields for data entry

To label an `<input>`, `<select>`, or `<textarea>`, use a `[<label>]
(https://developer.mozilla.org/docs/Web/HTML/Element/label)`.\ Associate a
label with an input by giving the label's `for` attribute the same value as the
input's `id`.

### Make the most of HTML attributes

Make it easy for users to enter data, by using the appropriate `<input>` element
`<type>` attribute to provide the right keyboard on mobile and enable basic
built-in validation by the browser.

Always use `type="email"` for email addresses and `type="tel"` for phone
numbers.

Every `<input>`, `<select`, and `<textarea>` element should have an appropriate
`autocomplete` attribute, to improve accessibility and help users avoid
re-entering data.

### Make buttons helpful

Use `<button>` for buttons. You can also use `<input type="submit">`, but don't
use a `div` or some other random element acting as a button. Button elements
provide accessible behaviour, built-in form submission functionality, and can
easily be styled.

Give each form submit button a value that says what it does. For each step
towards checkout, use a descriptive call-to-action that shows progress and
makes the next step obvious. For example, label the submit button on your
delivery address form **Proceed to Payment** rather than **Continue**
or **Save**.

### Use a single name input where possible

Allow your users to enter their name using a single input, unless you have a
good reason for separately storing given names, family names, honorifics, or
other name parts. Using a single name input makes forms less complex, enables
cut-and-paste, and makes autofill simpler.

Allow international names. For validation, avoid using regular expressions that
only match Latin characters. Latin-only excludes users with names or addresses
that include characters that aren't in the Latin alphabet. Allow Unicode letter
matching instead—and ensure your backend supports Unicode securely as both
input and output. Unicode in regular expressions is well supported by modern
browsers.

### Allow for a variety of address formats

When adding form fields for an address in a payment form, be aware of the
variety of address formats, even within a single country. Do not make
assumptions about "normal" addresses.

If possible within your data requirements, consider using a single `<textarea>`
element for address. This is the most flexible option for a variety of local
and international address formats.

### Use autocomplete for billing address

By default, set the billing address to be the same as the delivery address.
Reduce visual clutter by providing a link to edit the billing address (or use
summary and details elements) rather than displaying the billing address in a
form.

Use appropriate autocomplete values for the billing address, just as you do for
shipping address, so the user doesn't have to enter data more than once. Add a
prefix word to autocomplete attributes if you have different values for inputs
with the same name in different sections. For example:

```
<input autocomplete="shipping address-line-1" ...>
...
<input autocomplete="billing address-line-1" ...>
```

### Show checkout progress

For each step towards payment, use page headings and descriptive button values that make it clear what needs to be done now, and what checkout step is next.

Use the `enterkeyhint` attribute on form inputs to set the mobile keyboard enter
key label. For example, use `enterkeyhint="previous"` and `enterkeyhint="next"`
within a multi-page form, `enterkeyhint="done"` for the final input in the
form, and `enterkeyhint="search"` for a search input.

### Help users avoid re-entering payment data

Make sure to add appropriate `autocomplete` values in payment card forms,
including the payment card number, name on the card, and the expiry month and
year:

-   `cc-number`
-   `cc-name`
-   `cc-exp-month`
-   `cc-exp-year`

This enables browsers to help users by securely storing payment card details
and correctly entering form data. Without autocomplete, users may be more likely
to keep a physical record of payment card details, or store payment card data
insecurely on their device.

### Use a single input for payment card and phone numbers

For payment card and phone numbers use a single input: don't split the number into parts. That makes it easier for users to enter data, makes validation simpler, and enables browsers to autofill. Consider doing the same for other numeric data such as PIN and bank codes.

### Validate carefully

You should validate data entry both in realtime and before form submission. One
way to do this is by adding a pattern attribute to a payment card input. If the
user attempts to submit the payment form with an invalid value, the browser
displays a warning message and sets focus on the input.

However, your pattern regular expression must be flexible enough to handle the
range of payment card number lengths: from 14 digits (or possibly less) to 20
(or more). Card security codes (also known as CSC, CVC, CVV, or other names)
consist of 3 or 4 digits.

Allow users to include spaces when they're entering a new payment card number,
since this is how numbers are displayed on physical cards. That's friendlier to
the user (you won't have to tell them "they did something wrong"), less likely
to interrupt conversion flow, and it's straightforward to remove spaces in
numbers before processing.

### Help save users from accidentally missing data fields

Add the `required` attribute to both email and password fields. Modern browsers automatically prompt and set focus for missing data.