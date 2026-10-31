---
name: combobox
description: "Build a combobox: a text input combined with a filterable popup list of options the user can type into to narrow and select from."
web-feature-ids:
  - customizable-select
  - datalist
---

# Combobox

A combobox pairs a text field with a popup list: the user types to narrow the options and can either pick one or submit their own free-form value. Build it on top of a customizable `<select>` (`appearance: base-select`) so the popup, keyboard handling, light dismiss, `Escape`, focus management, and form submission all come from the platform, and only the filter and "add" behavior is written in JavaScript. For browsers without customizable select, the same markup degrades to an `<input list>` bound to a `<datalist>`.

If the user only needs to narrow a fixed list and never enter a value that is not already an option, build the same control without the "Add" button (steps 3–6 minus the `add` pieces) and drop the `<input list>` free-form fallback in favor of a plain `<select>`.

{# Verified in Chrome 150 (Oct 2026). Design constraints that drove this guide: the HTML parser closes <select> on <input>/<button>; HTMLSelectElement has showPicker() but no hidePicker(); Chrome does not dispatch toggle on <select>; input type=search consumes Escape to clear itself. #}

## How to implement

### 1. Author the fallback markup first

Write a standard `<input list>` + `<datalist>` combobox in HTML. It works everywhere and is what non-supporting browsers keep. Give it a `<label>`, a `name`, and `autocomplete="off"` so the browser's own autofill suggestions do not compete with the list.

```html
<div id="fallback">
  <label for="fruit-input">Fruit</label>
  <input id="fruit-input" name="fruit" list="fruits" autocomplete="off">
  <datalist id="fruits">
    <option value="Apple"></option>
    <option value="Banana"></option>
  </datalist>
</div>
```

### 2. Add the customizable `<select>` as the enhanced control

Place a hidden `<select>` with the same `name` and `<label>` next to the fallback. Opt in with `appearance: base-select` on both the `<select>` and its `::picker(select)`, and include a `<button>` with `<selectedcontent>` so the closed control shows the current choice. Use a hidden placeholder option with an empty `value` so nothing is submitted until the user chooses.

```html
<div id="enhanced" hidden>
  <label for="fruit-select">Fruit</label>
  <select id="fruit-select" name="fruit" class="combo">
    <button type="button"><selectedcontent></selectedcontent></button>
    <option value="" hidden>Select a fruit</option>
    <option value="Apple">Apple</option>
    <option value="Banana">Banana</option>
  </select>
  <!-- Announces how many options match the current filter -->
  <p role="status"></p>
</div>
```

```css
.combo, .combo::picker(select) { appearance: base-select; }
.combo option[hidden] { display: none; }

.combo::picker(select) {
  /* Fits the filter plus about 5-6 rows (example value); the list scrolls beyond it */
  max-block-size: 18rem;
  margin-block: 0.375rem;
}
```

DO NOT set `inset-block-start: anchor(bottom)` (or other `inset`/`top` anchoring) on `::picker(select)`. It disables the browser's built-in flip-when-out-of-space positioning, so near the bottom of a short viewport the picker is clipped to one or two rows instead of moving above the control. Use `margin` for spacing and leave placement to the platform.

### 3. Insert the filter input and "add" button with the DOM, not HTML

**MANDATORY:** Create the filter `<input>` and the "Add" `<button>` in JavaScript and insert them into the `<select>`. DO NOT write them in the HTML source: the HTML parser treats `<input>` (and any `<button>` after the first) as the end of the `<select>`, so they would land outside the control and the picker would not contain them.

Use `type="text"`, not `type="search"`: a search input consumes `Escape` to clear itself, which blocks the platform's `Escape`-closes-the-picker behavior.

```js
if (CSS.supports('appearance', 'base-select')) {
  const select = document.getElementById('fruit-select');
  const filter = Object.assign(document.createElement('input'), {
    type: 'text', autocomplete: 'off', placeholder: 'Type to filter or add…'
  });
  filter.setAttribute('aria-label', 'Filter fruit');
  const add = Object.assign(document.createElement('button'), { type: 'button', hidden: true });

  // Before the first <option> so it is the first focusable thing in the picker
  select.querySelector('option').before(filter);
  select.append(add);

  // Only one control may submit under this name
  document.getElementById('fallback').remove();
  document.getElementById('enhanced').hidden = false;
}
```

### 4. Filter options and offer to add unmatched text

On `input`, hide options that do not match, show the "Add" button only when the text is non-empty and does not exactly match an existing option, and update the live region.

Steps 4–6 run inside the same `CSS.supports` block as step 3, so `select`, `filter`, and `add` are in scope.

```js
const status = document.querySelector('[role="status"]');
const options = () => [...select.querySelectorAll('option:not([value=""])')];

const update = () => {
  const q = filter.value.trim().toLowerCase();
  let count = 0;
  for (const o of options()) {
    const match = o.textContent.toLowerCase().includes(q);
    o.hidden = !match;
    if (match) count++;
  }
  add.hidden = !q || options().some(o => o.textContent.toLowerCase() === q);
  add.textContent = `Add “${filter.value.trim()}”`;
  status.textContent = `${count} option${count === 1 ? '' : 's'} available`;
};
filter.addEventListener('input', update);
```

### 5. Let the platform commit and close the picker

There is no `hidePicker()` on `<select>`; the picker closes only through user gestures (activating an option, `Escape`, or clicking outside). DO NOT try to close it from script. Instead, move focus onto the option you want chosen and let the user's next `Enter` or click commit it natively. This keeps `change` events, focus restoration to the `<select>`, and light dismiss consistent with every other `<select>` on the page.

```js
filter.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    options().find(o => !o.hidden)?.focus();
  } else if (e.key === 'Enter') {
    e.preventDefault();                    // do not submit the form from inside the picker
    const first = options().find(o => !o.hidden);
    if (first) first.focus();              // next Enter commits natively
    else if (!add.hidden) add.click();
  } else if (e.key === 'Escape' && filter.value) {
    e.preventDefault();                    // first Escape clears the filter; second closes natively
    filter.value = ''; update();
  } else if (e.key !== 'Escape' && e.key !== 'Tab') {
    e.stopPropagation();                   // keep typed letters from triggering <select> type-ahead
  }
});

add.addEventListener('click', () => {
  const text = filter.value.trim();
  const option = new Option(text, text);
  add.before(option);                      // becomes a real <option>, so it submits with the form
  option.selected = true;
  filter.value = text; update();
  option.focus();                          // user confirms with Enter or a click
});
```

### 6. Reset the filter when the picker closes

The `<select>` does not dispatch `toggle`, so reset the filter on the events that do fire on every close path: `change` (fires when the picker commits, including when it closes with the same value) and `focusout` leaving the control.

```js
const reset = () => { filter.value = ''; update(); };
select.addEventListener('change', reset);
select.addEventListener('focusout', e => { if (!select.contains(e.relatedTarget)) reset(); });
```

### Accessibility notes

- Keep the `<label>` pointing at the `<select>` and give the filter its own `aria-label`; the filter is a child of the control, not the control itself.
- The `role="status"` live region is what tells screen-reader users how many options remain after typing, since hiding options with `hidden` is otherwise silent.
- Added values become real `<option>` elements, so assistive technology reads them like any other choice and the form submits them unchanged.

## Fallback strategies

Treat the customizable select as a progressive enhancement over `<input list>` + `<datalist>`. Gate the enhancement on `CSS.supports('appearance', 'base-select')`, and remove the fallback control when enhancing so that exactly one field with the shared `name` is submitted. Users of non-supporting browsers still get a native combobox that filters as they type and accepts free-form values; what they lose is the styled picker, the explicit "Add" affordance, and the option count announcement.

{{ FEATURE_FALLBACKS("customizable-select") }}

### Browser support for datalist

{{ BASELINE_STATUS("datalist") }}

`<datalist>` suggestions render differently across browsers and may not appear at all for some input types, but the underlying `<input>` always accepts free-form text, so the core use case keeps working.
