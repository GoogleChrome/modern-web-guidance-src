# Forms Development: Unified Lowest Common Denominator (LCD) Mirror

This document represents the intersection of standard development practices for web forms as consistently evidenced across Gemini, Claude, and Codex Knowledge Mirrors.

---

## 1. Semantic HTML Structure

The following elements and patterns are the verified foundation for accessible and functional forms.

*   **`<form>`**: The mandatory container for form controls. Use the `novalidate` attribute when handling validation via the Constraint Validation API to disable default browser error UI.
*   **`<label>`**: Every input must have an associated label.
    *   **Explicit Association**: Use the `for` attribute on the label to match the `id` of the input (consistently identified as the preferred method).
    *   **Implicit Association**: Nesting the input inside the label.
*   **`<fieldset>` and `<legend>`**: Used to group related controls (e.g., radio groups or address sections) to provide necessary context.
*   **`<button>` types**:
    *   `type="submit"`: Explicitly defined for the primary form submission action.
    *   `type="button"`: Used for other actions to prevent accidental submissions.
*   **`<textarea>`**: Standard element for multi-line text input.

---

## 2. Specific Input Types

ONLY the following specific `<input type="...">` values were consistently listed or referenced across all sources for their ability to trigger specialized mobile keyboards or built-in validation:

*   `email`
*   `tel`
*   `url`
*   `number`
*   `date`
*   `time`
*   `search`
*   `color`
*   `range`
*   `checkbox`
*   `radio`

---

## 3. Essential Attributes

These attributes are critical for user experience, data serialization, and mobile optimization.

*   **`name`**: Required for the control's value to be included in form submission and `FormData`.
*   **`autocomplete`**: Crucial for UX and autofill. Consistently supported tokens include:
    *   `email`, `current-password`, `new-password`, `street-address`, `cc-number`.
*   **`inputmode`**: Hints to the browser which virtual keyboard to display. Consistently evidenced values:
    *   `numeric`, `decimal`.
*   **`enterkeyhint`**: Customizes the label of the "Enter" key on virtual keyboards. Consistently evidenced values:
    *   `next`, `done`, `send`.

---

## 4. Native Constraint Validation

The following attributes provide a baseline for browser-native validation without requiring JavaScript:

*   **`required`**: Ensures the field is not empty.
*   **`minlength` / `maxlength`**: Constraints for text character length.
*   **`min` / `max` / `step`**: Constraints for numeric and date types.
*   **`pattern`**: A Regular Expression for custom input validation.

---

## 5. JavaScript APIs

Modern JavaScript provides the following tools for interacting with form data and validation states.

### Constraint Validation API
*   **`checkValidity()`**: Returns `true` if the element/form meets all constraints.
*   **`reportValidity()`**: Checks validity and triggers the browser's native error UI.
*   **`setCustomValidity(message)`**: Sets a custom error message; an empty string `""` clears the error.
*   **`validity` Object**: Used to inspect specific error states:
    *   `valueMissing`, `typeMismatch`, `patternMismatch`, `tooShort`, `tooLong`, `rangeUnderflow`, `rangeOverflow`, `stepMismatch`, `customError`, `valid`.

### FormData API
*   **`new FormData(form)`**: Collects all named form fields into a single object.
*   **`Object.fromEntries(formData)`**: Converts a `FormData` object into a standard JavaScript object.
*   **`formdata` Event**: Fires when the `FormData` object is constructed, allowing for late-stage data modification.

---

## 6. CSS for Forms

The following pseudo-classes and properties are the standard for styling form states and branding native controls.

### Pseudo-classes
*   **`:valid` and `:invalid`**: Apply styles based on the current validity of the input.
*   **`:user-valid` and `:user-invalid`**: Apply styles only after a user has interacted with the field (avoiding premature errors on page load).

### Properties
*   **`accent-color`**: Styles native checkboxes, radio buttons, and range sliders with a specific brand color.
*   **`appearance: none`**: Resets native browser styling to allow for custom control designs.

---

## 7. Accessibility (A11y)

The following attributes and patterns ensure forms are perceivable and operable by all users.

*   **`aria-describedby`**: Links an input to helper text or error messages.
*   **`aria-invalid`**: Programmatically indicates an error state (`true`/`false`).
*   **`aria-live="polite"`**: Used on error containers to announce dynamic updates to screen readers.
*   **`aria-required="true"`**: Used to indicate a required field (often alongside the native `required` attribute).
*   **Focus Management**: Upon a failed submission, focus should be moved to the first invalid field or an error summary.

---

## 8. Core Best Practices

*   **Progressive Enhancement**: Ensure the form is functional with standard HTML/CSS before adding JavaScript enhancements.
*   **Prevent Double Submissions**: Provide a clear submit state (e.g., disabling the submit button) to prevent duplicate data entry during processing.
*   **Labels over Placeholders**: Never use a `placeholder` as a replacement for a `<label>`.
