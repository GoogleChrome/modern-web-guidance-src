---
name: checkbox-group
description: Build a checkbox group for non-mutually exclusive multiple-choice selections with a master checkbox to (un)select all and brand-consistent styling.
web-feature-ids:
  - subgrid
  - indeterminate
  - accent-color
  - masks
  - tmp-customizable-select-listbox # pending a11y SME
guides:
  - checkbox
---

# Checkbox Group

A checkbox group lets users pick any number of options, and a master checkbox selects or clears all of them at once. When only some options are checked, the master shows the mixed (indeterminate) state. For the checkbox styling itself (icons, animation, `accent-color`), follow the `checkbox` guide's approach; this guide covers the group structure, the master behavior, and the layout.

## 1. Group with `<fieldset>` and `<legend>`

MANDATORY: Wrap the group in a `<fieldset>` with a `<legend>` so assistive technology announces the group name. Put the master checkbox before the option list, inside the fieldset. Every checkbox, including the master, needs an associated `<label>` with a hit target of at least 44px.

```html
<fieldset>
  <legend>Active automatons</legend>

  <label class="master">
    <input type="checkbox" class="checkbox" id="select-all"
           aria-controls="robot-1 robot-2" />
    Select all automatons
  </label>

  <ul class="options">
    <li>
      <label>
        <input type="checkbox" class="checkbox" id="robot-1" name="robot" value="clockwork" />
        <span>Clockwork Courier</span>
        <span class="model">CW-01</span>
      </label>
    </li>
    <!-- A disabled option is excluded from select-all -->
    <li>
      <label>
        <input type="checkbox" class="checkbox" id="robot-2" name="robot" value="rustbucket" disabled />
        <span>Rust Bucket (offline)</span>
        <span class="model">RB-0</span>
      </label>
    </li>
  </ul>

  <output aria-live="polite"></output>
</fieldset>
```

* Keep the master's label stable ("Select all ..."). Do not list checked or unchecked items in it.
* Optionally add `aria-controls` on the master listing the option IDs; screen reader support is limited, so never rely on it.
* Use an `<output>` (a live region) for a short summary such as "2 of 4 available units active". It is optional; add it when the group is long enough that users benefit from a running count.

## 2. Master checkbox behavior

MANDATORY: Derive the master's state from the options whenever any option changes, and apply the master's state to the options when it changes. The `indeterminate` state has no HTML attribute; set the DOM property in JavaScript.

```js
const master = document.querySelector('#select-all');
// Exclude disabled options; they must never be changed by select-all.
const items = [...document.querySelectorAll('input[name="robot"]:not(:disabled)')];

function sync() {
  const checked = items.filter((item) => item.checked).length;
  master.checked = checked === items.length;
  // Mixed only when some, but not all, options are checked.
  master.indeterminate = checked > 0 && checked < items.length;
}

master.addEventListener('change', () => {
  items.forEach((item) => (item.checked = master.checked));
  sync();
});
items.forEach((item) => item.addEventListener('change', sync));
sync(); // Reflect options that are checked on page load.
```

Clicking an indeterminate master resolves to checked (all options selected), because the browser clears `indeterminate` and toggles `checked`.

## 3. Styling

Style the checkboxes (including the master) with `accent-color` for brand-consistent native rendering, and fall back to the custom `appearance: none` styling where `accent-color` is unsupported.

{{ INCLUDE("guides/ui-components/checkbox/guide.md#native-customization-with-accent-color") }}

Gate the custom styling below with `@supports not (accent-color: auto)` so it only applies as the fallback, with every rule scoped to the same checkbox class. To keep the fallback brand-consistent with the `accent-color` version, fill the `:checked` and `:indeterminate` states with the brand color and give the icon a contrasting color:

```css
@supports not (accent-color: auto) {
  /* Place the custom checkbox rules below inside this block; the :root icon variables stay outside it */
  .checkbox:is(:checked, :indeterminate) {
    color: #fff; /* Icon color, contrasting with the brand fill */
    background-color: #1a73e8; /* Example brand color; match accent-color */
    border-color: #1a73e8;
  }
}
```

{{ INCLUDE("guides/ui-components/checkbox/guide.md#fully-custom-styling-with-appearance-none") }}

Also add a disabled style for options that are offline or unavailable, and dim the label to match:

```css
.checkbox:disabled { cursor: not-allowed; opacity: 0.5; }
label:has(:disabled) { cursor: not-allowed; }
```

DO NOT remove focus indicators from the checkboxes.

## 4. Aligned layout with subgrid

Make the option list a grid and have each row use `subgrid`, so the checkbox, name, and secondary column (for example a model code) align across all rows regardless of content width.

```css
.options {
  display: grid;
  grid-template-columns: auto 1fr auto;
  column-gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Both the row and its label span all columns and inherit the tracks */
.options li,
.options label {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  align-items: center;
}

.options label {
  min-block-size: 44px;
  cursor: pointer;
}
```

## Fallbacks

{{ BASELINE_STATUS("subgrid") }}

{{ FEATURE_FALLBACKS("accent-color") }}

If your Baseline target does not support `accent-color`, use the `@supports not (accent-color: auto)` block above. This is a faithful fallback: the checkbox keeps its brand colors, icons, and indeterminate dash.

{{ BASELINE_STATUS("masks") }}

{{ BASELINE_STATUS("indeterminate") }}
