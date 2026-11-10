---
name: checkbox-group
description: Build a checkbox group for non-mutually exclusive multiple-choice selections with a master checkbox to (un)select all and brand-consistent styling.
web-feature-ids:
  - subgrid
  - indeterminate
  - accent-color
  # - tmp-customizable-select-listbox # pending a11y SME
guides:
  - checkbox
  - scrollability-affordance-hints
---

# Checkbox Group

A checkbox group lets users pick any number of options, and a master checkbox selects or clears all of them at once. When only some options are checked, the master shows the mixed (indeterminate) state. For the checkbox styling itself (icons, animation, `accent-color`), see {{ GUIDE_REF("checkbox") }}; this guide covers the group structure, the master behavior, and the layout.

## Choosing the pattern

MANDATORY: Default to a `<fieldset>` of `<label>`s with nested `<input type="checkbox">`, as described below. It has the best assistive technology support, needs no ARIA, works without JavaScript, and is the only pattern with native indeterminate support for a master checkbox. Use it when:

* The group has a master checkbox.
* Options carry secondary metadata that should align in columns.
* The list is long. Keep the checkboxes and bound the list's height in a scroll container (see section 4) instead of switching patterns.

{# Customizable `<select multiple>` listbox (`tmp-customizable-select-listbox`) guidance is pending a11y SME review (#1092 / #1237). #}
DO NOT replace a checkbox group with `<select multiple>`: native listboxes have no indeterminate master control and rely on platform-dependent multi-select interactions (such as holding a modifier key on desktop). Use labeled checkboxes unless the use case explicitly requires a listbox.

## 1. Group with `<fieldset>` and `<legend>`

MANDATORY: Wrap the group in a `<fieldset>` with a `<legend>` so assistive technology announces the group name. Put the master checkbox before the option list, inside the fieldset. Every checkbox, including the master, needs an associated `<label>` with a hit target of at least 44px.

```html
<fieldset>
  <legend>Active automatons</legend>

  <label class="master" for="select-all">
    <input type="checkbox" class="checkbox" id="select-all"
           aria-controls="robot-1" />
    Select all automatons
  </label>

  <div class="options">
    <label for="robot-1">
      <input type="checkbox" class="checkbox" id="robot-1" name="robot" value="clockwork" />
      <span>Clockwork Courier</span>
    </label>
    <!-- A disabled option is excluded from select-all -->
    <label for="robot-2">
      <input type="checkbox" class="checkbox" id="robot-2" name="robot" value="rustbucket" disabled />
      <span>Rust Bucket (offline)</span>
    </label>
  </div>

  <output aria-live="polite"></output>
</fieldset>
```

* Keep the master's label stable ("Select all ..."). Do not list checked or unchecked items in it.
* Optionally add `aria-controls` on the master listing the option IDs; screen reader support is limited, so never rely on it.
* Include an `<output>` (a live region) with a short summary such as "2 of 4 available units active" whenever the group has a master checkbox. Without it, a bulk change from select-all is silent to screen reader users. Update its text whenever the master's state is re-derived.

## 2. Master checkbox behavior

Derive the master's state from the options whenever any option changes, and apply the master's state to the options when the master checkbox is directly interacted with.

* On load and whenever any option changes, derive the master from the **enabled** options only:
  * All checked: `checked = true`, `indeterminate = false`.
  * Some checked: `checked = false`, `indeterminate = true`. There is no HTML attribute for this; set the DOM property.
  * None checked: both `false`.
* When the master is directly toggled by the user, copy its `checked` value onto every enabled option. Do not re-derive the master afterwards; the options now match it. No special case is needed for the mixed state: clicking an indeterminate checkbox clears `indeterminate` and toggles `checked` before `change` fires, so a mixed master becomes checked and selects all options.
* Never read or write disabled options. If no option is enabled, disable the master and give it the state the disabled options would produce (unchecked when the list is empty).
* After each derive, update the `<output>` text with the count of checked versus enabled options, for example "2 of 4 available units active".
* Compute the enabled set at derive time, not once at setup, so options disabled or enabled at runtime stay in sync.

### When and how to include a master checkbox

The master is a convenience control. The options remain the source of truth, and the master's state is always derived from them.

* Include a master only when the group has 4 or more options and selecting all or none is a plausible user goal.
* Place the master first inside the `<fieldset>`, before the options, and separate it visually (for example a divider or heavier font weight) so it reads as a control over the group, not as another option.
* Keep the label static ("Select all ..."). A label that flips between "Select all" and "Deselect all" is announced as a change in meaning to screen reader users, while the checked and mixed states already convey the current status.
* Give the master no `name` attribute so it is not submitted with the form. Only the options carry `name` and `value`.
* If there are no enabled options (including an empty list), set `disabled` on the master and give it the checked or mixed state the disabled options would produce (unchecked for an empty list).
* For filtered or paginated lists, filter `options` to the visible, enabled items only, name that scope in the label (for example "Select all 12 shown"), and re-run `sync()` whenever the visible or enabled set changes.

## 3. Styling

Style the checkboxes (including the master) with `accent-color` for brand-consistent native rendering, or see {{ GUIDE_REF("checkbox") }} for custom `appearance: none` styling.

```css
.checkbox {
  font-size: 1rem; /* Keeps the em-based sizes below predictable */
  accent-color: #1a73e8;
  inline-size: 1.25em;
  aspect-ratio: 1;
  margin: 0;
  cursor: pointer;
}
```

DO NOT remove focus indicators from the checkboxes.

{{ FEATURE_ISSUES("accent-color") }}

## 4. Layout

Style `.master` with a 44px minimum hit target and a visual separator:

```css
.master {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-block-size: 44px;
  margin-block-end: 0.5rem;
  padding-block-end: 0.5rem;
  border-block-end: 1px solid #e1e2e4; /* Example divider */
  font-weight: 600;
  cursor: pointer;
}
```

### Label-only rows (the common case)

MANDATORY: The checkbox must stay at the inline-start of all label text, including wrapped lines and hints. Do not use a flex label: the text becomes flex items beside the checkbox, so a long label can wrap underneath it. Instead position the label (`position: relative`), reserve space with `padding-inline-start` (checkbox width plus gap), and pin the checkbox into that space with `position: absolute` and `inset-inline-start: 0`. Checkbox dimensions are uniform, so no wrapper `<span>` is needed, and logical properties keep it correct in RTL:

```css
.options label {
  position: relative;
  display: block;
  padding-block: 10px; /* 24px line + 20px = 44px hit target */
  padding-inline-start: 2rem; /* checkbox width + gap */
  line-height: 1.5rem;
  cursor: pointer;
}

/* Center the checkbox on the first line of text */
.options label > .checkbox {
  position: absolute;
  inset-inline-start: 0;
  inset-block-start: calc(10px + (1.5rem - 1.25em) / 2);
  margin: 0;
}
```

### Secondary column (the rarer case)

When rows have a secondary column (such as a trailing `<span class="model">CW-01</span>` inside each `<label>`), make `.options` a grid whose direct `<label>` children use `subgrid` (without `<ul>`/`<li>` wrappers) so the checkbox, name, and secondary column align across all rows. Wrap each column's content in a single `<span>`:

```css
.options {
  display: grid;
  grid-template-columns: auto 1fr auto;
  column-gap: 0.75rem;
}

.options label {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  align-items: center;
  padding: 0;
  min-block-size: 44px;
  cursor: pointer;
}

.options label > .checkbox { position: static; }
```

### Hint text

For a de-emphasized hint under the main label, place it outside `<label>` as a `<small>` with an `id`, and reference it from `<input>` with `aria-describedby` (putting a hint inside `<label>` includes it in the input's accessible name, causing `aria-describedby` to announce it twice). Keep the hint's contrast at 4.5:1 or better.

```html
<label for="robot-1">
  <input type="checkbox" class="checkbox" id="robot-1" name="robot" value="clockwork"
         aria-describedby="robot-1-hint" />
  <span>Clockwork Courier</span>
</label>
<small class="hint" id="robot-1-hint">Delivers parcels across the workshop.</small>
```

Align the hint with the label text, not the checkbox: use `display: block` and `margin-inline-start: 2rem` (checkbox width plus column gap) for label-only rows, or `grid-column: 2` when `.options` is a grid. Style it smaller and muted with at least 4.5:1 contrast.

### Radio groups

A radio group (mutually exclusive choice) uses the same structure: a `<fieldset>` with a `<legend>`, labeled native `<input type="radio">` elements sharing one `name`, the same layout, hint text, and `accent-color` styling. Omit the master checkbox, the indeterminate state, and the `sync()` script, and preselect a default option when one makes sense.

### Long lists

For long lists (provisionally about 12 or more options), keep the same markup and bound the list's height so the form stays compact. Leave the master checkbox outside the scroll container so it stays visible.

```css
.scroll-list {
  max-block-size: 16rem;
  padding-inline-start: 0.25rem;
  overflow-y: auto;
}
```

Without a visible cue, a list cut exactly between rows looks complete and overlay scrollbars stay hidden until scrolling. See {{ GUIDE_REF("scrollability-affordance-hints") }} to show that more options are below (and above).

Pad the scroll container's inline-start edge by at least the focus ring's outline width plus offset, because `overflow` clips the ring where the checkboxes touch the edge.

Scrolling regions are keyboard-reachable in current browsers because the checkboxes inside them are focusable. If the list can contain no focusable options (for example all disabled), add `tabindex="0"` so keyboard users can still scroll it.

## Fallback strategies

### Subgrid

{{ BASELINE_STATUS("subgrid") }}

Without subgrid, give each label the same fixed column widths so rows still align:

```css
@supports not (grid-template-columns: subgrid) {
  .options,
  .options label {
    grid-template-columns: 1.25rem 1fr 6rem; /* checkbox, name, secondary column */
    column-gap: 0.75rem;
  }
}
```

{{ FEATURE_FALLBACKS("accent-color") }}
