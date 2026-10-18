# Expectations: `autofill-highlight-inputs`

- The `:autofill` CSS pseudo-class MUST be used to style autofilled form controls. The incorrect spelling `:auto-fill` (with a hyphen) MUST NOT be used.
- The `:autofill` pseudo-class MUST be applied only to `<input>`, `<select>`, or `<textarea>` elements.
- If `:-webkit-autofill` is also used, it MUST be combined with `:autofill` inside `:is()` rather than listed as a separate selector in the same rule.
- JavaScript MUST NOT be used to apply inline styles to autofilled inputs (e.g. setting `element.style.*` in response to autofill).
- The autofilled state MUST NOT change layout-affecting properties (e.g. `border-width`, `padding`, `font-size`).
- At least one non-color indicator MUST be used to style the autofilled state (e.g. a thicker inset ring via `box-shadow`).
- The autofilled fill MUST be applied via inset `box-shadow`, not `background-color`.
- `outline: none` MUST NOT be applied to autofilled elements.
- If `outline` is used to style autofilled elements, the `:autofill:focus-visible` state MUST have an outline that differs in more than color (e.g. thickness, style, or offset).
