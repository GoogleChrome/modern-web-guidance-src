---
name: filterable-select
description: Build a filterable select control that allows users to type to narrow down a list of predefined options.
web-feature-ids:
  - customizable-select
  - popover
  - anchor-positioning
---

# Filterable select

A filterable select lets the user type to narrow a list of predefined options and choose one or more of them. Build it on a customizable `<select>` (`appearance: base-select`) so the popup, keyboard handling, light dismiss, `Escape`, focus management, and form submission all come from the platform; only the filtering is written in JavaScript. This guide layers filtering over an already-styled customizable select; it does not cover styling or animating the popup. For choosing several options, use the checkbox popover in step 6.

{# Verified in Chrome 150 (Oct 2026). Design constraints that drove this guide: the HTML parser closes `<select>` on `<input>`/`<button>`; HTMLSelectElement has showPicker() but no hidePicker(); Chrome does not dispatch toggle on `<select>`; input type=search consumes Escape to clear itself. #}

## Choosing a pattern

There are two search patterns for a constrained set of options:

- **Search in the dropdown (this guide):** the trigger stays a button and the filter input lives inside the popup. Choose it for small to medium lists that users mostly browse, where picking from a visible list is the main interaction.
- **Search in the trigger (combobox):** the trigger itself is a text input. Choose it for large or unfamiliar lists where users type first, or when options load asynchronously.

A customizable `<select>` cannot put a text input in its trigger, so the combobox pattern isn't possible with it and isn't covered here.

## How to implement

### 1. Author a plain `<select>` first

A native `<select>` with a `<label>` and a `name` is the fallback. Add a hidden placeholder option with an empty `value` so nothing is submitted until the user chooses. Add a `<button><selectedcontent></selectedcontent></button>` trigger for the enhanced version; non-supporting browsers ignore it.

```html
<label for="fruit">Fruit</label>
<select id="fruit" name="fruit" class="filterable-select">
  <button type="button"><selectedcontent></selectedcontent></button>
  <option value="" hidden>Select a fruit</option>
  <option value="Apple">Apple</option>
  <option value="Banana">Banana</option>
</select>
<!-- Announces how many options match the current filter -->
<p role="status"></p>
```

```css
.filterable-select, .filterable-select::picker(select) { appearance: base-select; }
.filterable-select option[hidden] { display: none; }

/* Keep a visible outline on the focused option: a background tint alone has too little
   contrast and disappears in forced colors */
.filterable-select option:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }

.filterable-select::picker(select) {
  /* Fits the filter plus about 5-6 rows (example value); the list scrolls beyond it */
  max-block-size: 18rem;
  /* Keeps Chrome from shrinking the list to the filter plus one row */
  min-block-size: min(18rem, 50dvh);
  overflow-y: auto;
  margin-block: 0.375rem;
}
```

DO NOT set `inset-block-start: anchor(bottom)` (or other `inset`/`top` anchoring) on `::picker(select)`. It disables the browser's built-in flip-when-out-of-space positioning, so near the bottom of a short viewport the picker is clipped instead of moving above the control. Use `margin` for spacing.

### 2. Insert the filter input with the DOM, not HTML

**MANDATORY:** Create the filter `<input>` and the empty-state element in JavaScript and insert them into the `<select>`. DO NOT write them in the HTML source: the HTML parser treats `<input>` as the end of the `<select>`, so it would land outside the control and the picker would not contain it.

Use `type="text"`, not `type="search"`: a search input consumes `Escape` to clear itself, which blocks the platform's `Escape`-closes-the-picker behavior.

```js
if (CSS.supports('appearance', 'base-select')) {
  const select = document.getElementById('fruit');
  const filter = Object.assign(document.createElement('input'), {
    type: 'text', autocomplete: 'off', placeholder: 'Type to filter…'
  });
  filter.setAttribute('aria-label', 'Filter fruit');
  const empty = Object.assign(document.createElement('div'), { hidden: true, textContent: 'No matches' });

  // Before the first <option> so it is the first focusable thing in the picker
  select.querySelector('option').before(filter);
  select.append(empty);
}
```

### 3. Filter options

On `input`, hide options that do not match and update the live region.

Steps 3–5 run inside the same `CSS.supports` block as step 2.

```js
const status = document.querySelector('[role="status"]');
const options = () => [...select.querySelectorAll('option:not([value=""])')];

const apply = () => {
  const q = filter.value.trim().toLowerCase();
  let count = 0;
  for (const o of options()) {
    const match = o.textContent.toLowerCase().includes(q);
    o.hidden = !match;
    if (match) count++;
  }
  empty.hidden = count > 0;
  status.textContent = `${count} option${count === 1 ? '' : 's'} available`;
};
const update = apply;
filter.addEventListener('input', update);

// The select's own handling can move focus away from the input after pointerdown,
// so refocus once the browser's default handling has finished
const focusFilter = () => requestAnimationFrame(() => {
  if (select.matches(':open') && document.activeElement !== filter) filter.focus();
});
filter.addEventListener('pointerdown', focusFilter);
filter.addEventListener('click', focusFilter);
// Opening via mouse or keyboard should land in the filter so the user can type immediately
select.addEventListener('click', focusFilter);
select.addEventListener('keydown', e => {
  if (e.target === select && [' ', 'Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
    focusFilter();
  } else if (e.key === 'ArrowUp' && e.target === options().find(o => !o.hidden)) {
    // Native arrow handling only moves between options, so route back to the filter
    e.preventDefault();
    filter.focus();
  }
});
```

### 4. Let the platform commit and close the picker

There is no `hidePicker()` on `<select>`; the picker closes only through user gestures (activating an option, `Escape`, or clicking outside). DO NOT try to close it from script. Move focus onto the option you want chosen and let the user's next `Enter` or click commit it natively.

```js
filter.addEventListener('keydown', e => {
  const first = options().find(o => !o.hidden);
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    first?.focus();
  } else if (e.key === 'Enter') {
    e.preventDefault();                    // do not submit the form from inside the picker
    first?.focus();                        // next Enter commits natively
  } else if (e.key === 'Escape' && filter.value) {
    e.preventDefault();                    // first Escape clears the filter; second closes natively
    filter.value = ''; update();
  } else if (e.key !== 'Escape' && e.key !== 'Tab') {
    e.stopPropagation();                   // keep typed letters from triggering <select> type-ahead
  }
});
```

### 5. Reset the filter when the picker closes

The `<select>` does not dispatch `toggle`, so reset the filter on `focusout` whenever the picker is no longer `:open` on the next animation frame. This covers committing a new or unchanged option, pressing `Escape`, and light-dismissing outside the control.

```js
const reset = () => {
  filter.value = '';
  for (const o of options()) o.hidden = false;
  empty.hidden = true;
  status.textContent = '';                 // the list is closed, so announce nothing
};
select.addEventListener('focusout', () => requestAnimationFrame(() => {
  if (!select.matches(':open')) reset();
}));
```

### 6. Selecting more than one item

`<select multiple>` is an always-open listbox in customizable select (it has no popup, so `showPicker()` does nothing), so DO NOT use it for a dropdown that stays open while the user clicks several options. Build the multi-select as a trigger button that opens a `popover` containing the filter input and a `<fieldset>` of checkboxes. Checkboxes submit under the shared `name` natively. Popover provides light dismiss, `Escape`, and focus return; `autofocus` on the input moves focus to it when the popover opens.

```html
<label id="toppings-label" for="toppings-trigger">Toppings</label>
<button type="button" id="toppings-trigger" popovertarget="toppings-panel"
        aria-labelledby="toppings-label toppings-trigger" aria-describedby="toppings-selected">Select toppings</button>
<!-- Muted list of the chosen options, visible while the popover is closed -->
<p id="toppings-selected">None selected</p>
<div id="toppings-panel" popover>
  <input type="text" autocomplete="off" aria-label="Filter toppings" autofocus>
  <fieldset>
    <legend>Toppings</legend>
    <label><input type="checkbox" name="toppings" value="Basil"> Basil</label>
    <label><input type="checkbox" name="toppings" value="Olives"> Olives</label>
  </fieldset>
</div>
<p role="status"></p>
```

Position the panel under the trigger with anchor positioning (`anchor-name` on the trigger; `position-anchor`, `position-area: block-end`, `position-try-fallbacks: flip-block`, and `inline-size: anchor-size(width)` on the panel) so the platform flips it when space runs out.

Filter the checkbox labels the same way as step 3 (hide non-matching labels with `hidden`; checked boxes stay checked and keep submitting while hidden), prevent `Enter` in the filter from submitting the form, and update the `role="status"` count. Add ArrowDown/ArrowUp to move focus between the filter and the visible checkboxes so the list behaves like the single select; Tab and Space keep working natively. List the checked labels in the muted `<p>` after every `change` (it is read through `aria-describedby`, not a live region, because the filter's `role="status"` already announces). Clear the filter and unhide all labels on the popover's `toggle` event when `newState` is `closed`.

```js
const visible = () => items.filter(l => !l.hidden).map(l => l.querySelector('input'));
filter.addEventListener('keydown', e => {
  if (e.key === 'Enter') e.preventDefault();
  if (e.key === 'ArrowDown') { e.preventDefault(); visible()[0]?.focus(); }
});
panel.addEventListener('keydown', e => {
  if (!['ArrowDown', 'ArrowUp'].includes(e.key) || e.target.type !== 'checkbox') return;
  e.preventDefault();
  const list = visible();
  const i = list.indexOf(e.target) + (e.key === 'ArrowDown' ? 1 : -1);
  (list[i] ?? (i < 0 ? filter : list.at(-1))).focus();
});
panel.addEventListener('change', () => {
  const names = [...panel.querySelectorAll('input:checked')].map(i => i.parentElement.textContent.trim());
  selected.textContent = names.join(', ') || 'None selected';
});
```

### Accessibility notes

- Keep the `<label>` pointing at the `<select>` and give the filter its own `aria-label`; the filter is a child of the control, not the control itself.
- The `role="status"` live region is what tells screen-reader users how many options remain after typing, since hiding options with `hidden` is otherwise silent.

## Fallback strategies

Treat the customizable select as a progressive enhancement over a plain `<select>`. Gate the enhancement on `CSS.supports('appearance', 'base-select')`. Users of non-supporting browsers keep a native `<select>` with built-in type-ahead; what they lose is the styled picker, the filter input, and the option count announcement.

{{ FEATURE_FALLBACKS("customizable-select") }}

{{ FEATURE_FALLBACKS("popover") }}

{{ FEATURE("anchor-positioning", "popover-fallbacks") }}
