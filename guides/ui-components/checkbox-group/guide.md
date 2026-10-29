---
name: checkbox-group
description: Build a checkbox group for non-mutually exclusive multiple-choice selections with a master checkbox to (un)select all and brand-consistent styling.
web-feature-ids:
  - subgrid
  - indeterminate
  - accent-color
  - masks
  # - tmp-customizable-select-listbox # pending a11y SME
guides:
  - checkbox
---

# Checkbox Group

A checkbox group lets users pick any number of options, and a master checkbox selects or clears all of them at once. When only some options are checked, the master shows the mixed (indeterminate) state. For the checkbox styling itself (icons, animation, `accent-color`), follow the `checkbox` guide's approach; this guide covers the group structure, the master behavior, and the layout.

## Choosing the pattern

MANDATORY: Default to a `<fieldset>` of `<label>`s with nested `<input type="checkbox">`, as described below. It has the best assistive technology support, needs no ARIA, works without JavaScript, and is the only pattern with native indeterminate support for a master checkbox. Use it when:

* The group has a master checkbox.
* Options carry secondary metadata that should align in columns.
* The list is long. Keep the checkboxes and bound the list's height in a scroll container (see section 4) instead of switching patterns.

A customizable `<select multiple>` listbox may suit long, height-bounded lists that need type-ahead or compact form space, but this guidance is pending a11y SME review, and it cannot render per-row checkboxes in browsers without `appearance: base-select`. DO NOT choose the listbox pattern; use labeled checkboxes unless the use case explicitly requires a listbox.

## 1. Group with `<fieldset>` and `<legend>`

MANDATORY: Wrap the group in a `<fieldset>` with a `<legend>` so assistive technology announces the group name. Put the master checkbox before the option list, inside the fieldset. Every checkbox, including the master, needs an associated `<label>` with a hit target of at least 44px.

```html
<fieldset>
  <legend>Active automatons</legend>

  <label class="master">
    <input type="checkbox" class="checkbox" id="select-all"
           aria-controls="robot-1" />
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
* Include an `<output>` (a live region) with a short summary such as "2 of 4 available units active" whenever the group has a master checkbox. Without it, a bulk change from select-all is silent to screen reader users. Update its text in `sync()`.

## 2. Master checkbox behavior

MANDATORY: Derive the master's state from the options whenever any option changes, and apply the master's state to the options when it changes. The `indeterminate` state has no HTML attribute; set the DOM property in JavaScript.

```js
const master = document.querySelector('#select-all');
const summary = document.querySelector('fieldset output');
// Exclude disabled options; they must never be changed by select-all.
const items = [...document.querySelectorAll('input[name="robot"]:not(:disabled)')];

function sync() {
  const checked = items.filter((item) => item.checked).length;
  master.disabled = items.length === 0;
  master.checked = items.length > 0 && checked === items.length;
  // Mixed only when some, but not all, options are checked.
  master.indeterminate = checked > 0 && checked < items.length;
  // Announce the running count so bulk changes are not silent.
  summary.textContent = `${checked} of ${items.length} available units active`;
}

master.addEventListener('change', () => {
  items.forEach((item) => (item.checked = master.checked));
  sync();
});
items.forEach((item) => item.addEventListener('change', sync));
sync(); // Reflect options that are checked on page load.
```

Clicking an indeterminate master resolves to checked (all options selected), because the browser clears `indeterminate` and toggles `checked`.

### When and how to include a master checkbox

The master is a convenience control. The options remain the source of truth, and the master's state is always derived from them.

* Include a master only when the group has 4 or more options and selecting all or none is a plausible task. Omit it for 2-3 options.
* DO NOT add a master when selecting everything is destructive or risky (for example deleting items or granting permissions).
* Place the master first inside the `<fieldset>`, before the options, and separate it visually (for example a divider or heavier font weight) so it reads as a control over the group, not as another option.
* Keep the label static ("Select all ..."). A label that flips between "Select all" and "Deselect all" is announced as a change in meaning to screen reader users, while the checked and mixed states already convey the current status.
* Give the master no `name` attribute so it is not submitted with the form. Only the options carry `name` and `value`.
* If there are no enabled options, set `disabled` on the master.
* For filtered or paginated lists, the master applies to the visible, enabled options only. Name that scope in the label (for example "Select all 12 shown") and recompute the master's state whenever the visible set changes.

```js
// After filtering or when the enabled set changes, rebuild `items` and re-sync.
master.disabled = items.length === 0;
```

## 3. Styling

Style the checkboxes (including the master) with `accent-color` for brand-consistent native rendering, or see {{ GUIDE_REF("checkbox") }} for custom `appearance: none` styling.

```css
.checkbox {
  accent-color: #1a73e8;
  inline-size: 1.25em;
  aspect-ratio: 1;
  margin: 0;
  cursor: pointer;
}
```

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

### Long lists

For long lists (provisionally about 12 or more options), keep the same markup and bound the list's height so the form stays compact. Leave the master checkbox outside the scroll container so it stays visible.

```css
.scroll-list {
  max-block-size: 16rem;
  overflow-y: auto;
}
```

Scrolling regions are keyboard-reachable in current browsers because the checkboxes inside them are focusable. If the list can contain no focusable options (for example all disabled), add `tabindex="0"` so keyboard users can still scroll it.

## Fallbacks

{{ BASELINE_STATUS("subgrid") }}

{{ FEATURE_FALLBACKS("accent-color") }}

If your Baseline target does not support `accent-color`, use the `@supports not (accent-color: auto)` block above. This is a faithful fallback: the checkbox keeps its brand colors, icons, and indeterminate dash.

{{ BASELINE_STATUS("masks") }}

{{ BASELINE_STATUS("indeterminate") }}
