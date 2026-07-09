# Expectations: `autofill-highlight-inputs`

- The `:autofill` CSS pseudo-class MUST be used to style autofilled form controls. The incorrect spelling `:auto-fill` (with a hyphen) MUST NOT be used.
- The `:autofill` pseudo-class MUST be applied only to `<input>`, `<select>`, or `<textarea>` elements.
- JavaScript MUST NOT be used to apply inline styles to autofilled inputs (e.g. setting `element.style.*` in response to autofill).
- Multiple visual state indicators MUST be used to style the autofilled state (e.g. modifying both border thickness/color and background via `box-shadow`) to avoid relying on color alone.
- The focus indicator MUST be preserved on autofilled elements; if `outline: none` is used, an explicit replacement focus outline MUST be provided for the `:focus-visible` state.
