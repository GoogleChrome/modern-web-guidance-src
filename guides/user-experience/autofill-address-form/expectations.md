# Expectations: `autofill-address-form`

- `<input>`, `<select>`, and `<textarea>` elements MUST be within a `<form>` element.
- Every form control MUST be visually labeled using a `<label>` element.
- Every `<label>` MUST have a `for` attribute whose value matches the `id` of its associated form control.
- A single `<textarea>` MUST be used for the street address entry (not multiple `<input>` elements for address parts). The `<textarea>` MUST have `autocomplete="street-address"`.
- The postal code input MUST have `autocomplete="postal-code"`.
- The `type="number"` attribute MUST NOT be used on the postal code input.
- DO NOT enforce Latin-only characters for name or address inputs. Patterns MUST NOT restrict input to `[a-zA-Z]` only.
- All required fields MUST have the `required` attribute.
