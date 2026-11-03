---
name: checkbox-group
description: Build a checkbox group for non-mutually exclusive multiple-choice selections with a master checkbox to (un)select all and brand-consistent styling.
web-feature-ids:
  - subgrid
  - indeterminate
  - accent-color
  - container-scroll-state-queries
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
      <span class="model">CW-01</span>
    </label>
    <!-- A disabled option is excluded from select-all -->
    <label for="robot-2">
      <input type="checkbox" class="checkbox" id="robot-2" name="robot" value="rustbucket" disabled />
      <span>Rust Bucket (offline)</span>
      <span class="model">RB-0</span>
    </label>
  </div>

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
const group = master.closest('fieldset');
const summary = group.querySelector('output');
const options = [...group.querySelectorAll('input[name="robot"]')];

function sync() {
  // Filter dynamically so options disabled or enabled at runtime stay in sync.
  const enabled = options.filter((item) => !item.disabled);
  const checked = enabled.filter((item) => item.checked).length;
  master.disabled = enabled.length === 0;
  master.checked = enabled.length > 0 && checked === enabled.length;
  // Mixed only when some, but not all, enabled options are checked.
  master.indeterminate = checked > 0 && checked < enabled.length;
  // Announce the running count so bulk changes are not silent.
  summary.textContent = `${checked} of ${enabled.length} available units active`;
}

master.addEventListener('change', () => {
  for (const item of options) {
    if (!item.disabled) item.checked = master.checked;
  }
  sync();
});
options.forEach((item) => item.addEventListener('change', sync));
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
* For filtered or paginated lists, filter `options` to the visible, enabled items only, name that scope in the label (for example "Select all 12 shown"), and re-run `sync()` whenever the visible or enabled set changes.

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
label:has(:disabled) { color: #8e9196; cursor: not-allowed; }
```

DO NOT remove focus indicators from the checkboxes.

{{ FEATURE_ISSUES("accent-color") }}

## 4. Aligned layout with subgrid

Style `.master` with a 44px minimum hit target and a visual separator, then make `.options` a grid whose direct `<label>` children use `subgrid` (without `<ul>`/`<li>` wrappers) so the checkbox, name, and optional secondary column align across all rows:

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

.options {
  display: grid;
  grid-template-columns: auto 1fr auto; /* Use auto 1fr when options have no secondary column */
  column-gap: 0.75rem;
}

.options label {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  align-items: center;
  min-block-size: 44px;
  cursor: pointer;
}
```

### Long lists

For long lists (provisionally about 12 or more options), keep the same markup and bound the list's height so the form stays compact. Leave the master checkbox outside the scroll container so it stays visible.

```css
.scroll-list {
  max-block-size: 16rem;
  padding-inline-start: 0.25rem;
  overflow-y: auto;
  container-type: scroll-state;
}

/* Fade at the bottom edge while more options are below */
.scroll-list::after {
  content: "";
  display: block;
  grid-column: 1 / -1; /* span every column when the list is a grid */
  position: sticky;
  inset-block-end: 0;
  block-size: 1.5rem;
  margin-block-start: -1.5rem;
  background: linear-gradient(to top, rgb(0 0 0 / 0.2), transparent);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}

@container scroll-state(scrollable: bottom) {
  .scroll-list::after {
    opacity: 1;
  }
}
```

Without a visible cue, a list cut exactly between rows looks complete and overlay scrollbars stay hidden until scrolling. See {{ GUIDE_REF("scrollability-affordance-hints") }} to show that more options are below (and above).

Pad the scroll container's inline-start edge by at least the focus ring's outline width plus offset, because `overflow` clips the ring where the checkboxes touch the edge.

Scrolling regions are keyboard-reachable in current browsers because the checkboxes inside them are focusable. If the list can contain no focusable options (for example all disabled), add `tabindex="0"` so keyboard users can still scroll it.

## Fallbacks

{{ BASELINE_STATUS("subgrid") }}

{{ FEATURE_FALLBACKS("accent-color") }}

If your Baseline target does not support `accent-color`, use the custom `appearance: none` styling from the {{ GUIDE_REF("checkbox") }} guide behind `@supports not (accent-color: auto)`.

{{ BASELINE_STATUS("indeterminate") }}

{{ BASELINE_STATUS("container-scroll-state-queries") }}

If your Baseline target does not support scroll-state queries, omit the bottom fade. This is graceful degradation: the list still scrolls and the count in the `<output>` still reports how many options exist, but nothing signals that more options are below.
