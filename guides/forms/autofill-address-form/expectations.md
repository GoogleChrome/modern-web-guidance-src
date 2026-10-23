# Expectations: `autofill-address-form`

- `<input>`, `<select>`, and `<textarea>` elements MUST be within a `<form>` element.
- Every form control MUST be visually labeled using a `<label>` element.
- Every `<label>` MUST have a `for` attribute whose value matches the `id` of its associated form control.
- The street address MUST be collected either as a single `<textarea>` with `autocomplete="street-address"` (preferred) or as separate line inputs where the first line has `autocomplete="address-line1"` (and any further lines use `address-line2`, `address-line3`). The street address MUST NOT be split across inputs that lack these `autocomplete` tokens.
- The postal code input MUST have `autocomplete="postal-code"`.
- DO NOT enforce Latin-only characters for name or address inputs. Patterns MUST NOT restrict input to `[a-zA-Z]` only.
- Mandatory fields (at minimum the name and the street address `<textarea>` or first address line) MUST have the `required` attribute.
