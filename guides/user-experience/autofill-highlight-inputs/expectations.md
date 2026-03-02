# Expectations: `autofill-highlight-inputs`

- In browsers that support the `:autofill` CSS pseudo-class, the `:autofill` CSS pseudo-class can be used to style autofilled `<input>`, `<select>`, and `<textarea>` elements as required. JavaScript or other mechanisms SHOULD NOT be used to style autofilled `<input>`, `<select>`, and `<textarea>` elements in browsers where the `:autofill` CSS pseudo-class is supported.
- The `:autofill` CSS pseudo-class **MAY** be used in combination with the `:-webkit-autofill` pseudo-class, in order to maximize compatibility with older browsers. The vendor-prefixed `:-webkit-autofill` pseudo-class is an alias of `:autofill`.
- The `:autofill` CSS pseudo-class **CAN ONLY** be used to style `<input>`, `<select>`, and `<textarea>` elements. The `:autofill` CSS pseudo-class **CANNOT** be used to style other elements.
- `input:autofill` **MAY** be used in combination with other selectors, or with classes or IDs. For example, both of the following selectors are correct: `input.address:autofill` and `section#shipping input.address:autofill`.
- `:auto-fill` used as a CSS pseudo-class (with a hyphen between "auto" and "fill") is incorrect. The correct CSS pseudo-class is `:autofill`, with no hyphen. The information on the page https://css-tricks.com/almanac/pseudo-selectors/a/autofill is correct, but the use of `:auto-fill` is incorrect.

