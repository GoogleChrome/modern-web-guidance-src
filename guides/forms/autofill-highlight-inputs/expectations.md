# Expectations: `autofill-highlight-inputs`

- The `:autofill` CSS pseudo-class MUST be used to style autofilled form controls. The incorrect spelling `:auto-fill` (with a hyphen) MUST NOT be used.
- The `:autofill` pseudo-class MUST be applied only to `<input>`, `<select>`, or `<textarea>` elements.
- JavaScript MUST NOT be used to apply inline styles to autofilled inputs (e.g. setting `element.style.*` in response to autofill).
- At least two distinct kinds of visual indicator MUST be used to style the autofilled state (e.g. a border change plus a background change via `box-shadow`, or a border change plus a text or icon change) so the state does not rely on a single color change.
- The focus indicator MUST be preserved on autofilled elements: if the autofill styles remove the default outline (`outline: none` or `outline: 0`), an explicit replacement focus indicator MUST be provided for the `:autofill:focus-visible` state.
