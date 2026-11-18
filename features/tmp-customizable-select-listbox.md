# Customizable select listbox

## Fallbacks

{# {{ BASELINE_STATUS("tmp-customizable-select-listbox") }} #}

Customizable select listbox is only supported in Chrome 145.
Older Chrome versions and Firefox do support more extensive styling of listboxes than Safari, though are still affected by the parsing limitations of non-customizable `<select>`.

**Feature detection:** `CSS.supports('appearance: base-select')` detects customizable select in general, which may or may not include customizable listbox support.
To test specifically for customizable listbox, use that as a gate, and if it returns true, insert this HTML to the page:

```html
<select size="2">
  <option>Option 1</option>
  <option>Option 2</option>
</select>
<select size="2" style="appearance: base-select">
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

and check if the second select is rendered with different dimensions.

**Fallback strategies:** Depending on the use case:
1. If a regular listbox with limited/no styling is acceptable, just use this as a progressive enhancement.
2. Otherwise, do not use customizable select at all.
