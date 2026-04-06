# Expectations: `autofill-highlight-inputs`

- The `:autofill` CSS pseudo-class MUST be used to style autofilled form controls. The incorrect spelling `:auto-fill` (with a hyphen) MUST NOT be used.
- The `:autofill` pseudo-class MUST be applied only to `<input>`, `<select>`, or `<textarea>` elements.
- JavaScript MUST NOT be used to apply inline styles to autofilled inputs (e.g. setting `element.style.*` in response to autofill).
