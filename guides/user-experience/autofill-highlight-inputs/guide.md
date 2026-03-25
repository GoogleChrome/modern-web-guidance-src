---
name: autofill-highlight-inputs
description: Use CSS to highlight form fields that have been autofilled by the browser and not edited by the user.
web-feature-ids:
  - autofill
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:autofill
  - https://developer.mozilla.org/docs/Web/HTML/Element/input
  - https://developer.mozilla.org/docs/Web/HTML/Element/select
  - https://developer.mozilla.org/docs/Web/HTML/Element/textarea
  - https://css-tricks.com/almanac/pseudo-selectors/a/autofill
---

# Use the CSS :autofill pseudo-class to highlight form fields that have been autofilled by the browser and not edited by the user

Use the CSS `:autofill` to highlight fields that have (or have not been) autofilled, to help guide the user to successful form completion.

## How to implement

To highlight a form field that has been autofilled by the browser (and not edited by the user) add a selector to your CSS using the `:autofill` class. This can be used for an `<input>`, `<select>`, or `<textarea>` element.

The following example uses `:autofill` to set border color:

```css
input:autofill,
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus {
  /* box-shadow overrides the autofill background color, which cannot be changed via background-color */
  /* box-shadow: 0 0 0 100vmax #efe inset; */
  border-color: green;
  outline: none;
}
```

As shown in this example, the `box-shadow` property can be used to customize the background if required, since `background-color` cannot be overridden directly.

## Use the correct CSS pseudo-class name

**Do not** use `:auto-fill`: this is incorrect.

MANDATORY: Use `:autofill` as this is the correct pseudo-class name.

### Fallback strategies

{{ BASELINE_STATUS("autofill") }}

The `:autofill` pseudo-class is a progressive enhancement. In browsers that do not support it, the form will still function normally, but the inputs will simply not receive the custom autofill highlighting. Users will still be able to successfully complete the form. No additional JavaScript fallback should be used.
