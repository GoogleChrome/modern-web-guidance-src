---
name: combobox
description: "Build a combobox: a text input combined with a filterable popup list of options the user can type into to narrow and select from."
web-feature-ids:
  - customizable-select
  - datalist
  - popover
  - anchor-positioning
---

{# Link to filterable-select if only filtering is needed #}

# Combobox

A combobox pairs a text input with a popup list of suggestions. Typing narrows the list, and the user either picks an option or keeps their own text. The value is always whatever is in the input.

## Choose an approach

* **Native `<datalist>`:** Use when plain text suggestions are enough. The browser supplies the popup, filtering, keyboard handling, and form integration. You cannot style the popup, highlight matches, or show an empty state.
* **Custom listbox (popover + ARIA combobox pattern):** Use when you need a branded popup, match highlighting, grouped or rich options, or an empty-state message. It costs more code and you own the keyboard and screen reader behavior.
* **Not a combobox:** If the user must choose only from the list (no freeform value), use a `<select>` styled with `appearance: base-select` instead (see {{ GUIDE_REF("branded-select-styling") }}). A combobox implies that unlisted values are accepted.

## Shared markup for native `<datalist>` and enhanced custom listbox

Always start from this `<datalist>` markup. It is the baseline for both approaches and the source of options for the custom listbox.

```html
<label for="city">Destination</label>
<input id="city" name="city" type="text" list="cities">
<datalist id="cities">
  <!-- The value attribute is what gets inserted into the input -->
  <option value="Amsterdam"></option>
  <option value="Berlin"></option>
</datalist>
```

## Custom listbox

### 1. Markup and roles

Enhance the shared markup above, reading the options from the `<datalist>`. Use semantic elements, not generic `<div>`/`<span>` wrappers:

* A real `<label>` linked to the `<input>`. Add help text with `aria-describedby`.
* The `<input type="text">` carries `role="combobox"`, `aria-controls` pointing at the listbox, `aria-expanded` (`true` only while the popup is shown), and `aria-autocomplete="list"`.
* The popup is a `<ul role="listbox">` with `<li role="option">` children, labeled with `aria-labelledby` pointing at the visible label. Create it from script only when enhancing, so browsers without popover support never render an empty list.
* Keep DOM focus on the input at all times. Indicate the highlighted option with `aria-activedescendant` on the input (set to the option's `id`) and `aria-selected="true"` on that option. Never move focus into the list.
* Remove the `list` attribute when enhancing, so the native datalist popup does not appear on top of the custom one.

### 2. Popup with the Popover API

Use `popover="manual"` on the listbox and call `showPopover()` / `hidePopover()` from script. `manual` is required because `auto` light-dismiss would steal or close on input focus; you close it yourself on Escape, blur, and selection. The popover renders in the top layer, so no `z-index` is needed.

Anchor the popup to the input with CSS so it sizes and flips without JavaScript measurement:

```css
input[role="combobox"] { anchor-name: --combobox; }

[role="listbox"] {
  position-anchor: --combobox;
  position-area: block-end span-inline-end;
  position-try-fallbacks: flip-block;   /* open upward when there is no room below */
  inline-size: anchor-size(inline);     /* match the input width */
  max-block-size: min(16rem, 50dvh);    /* example value; keep the list scrollable */
  overflow-block: auto;

  & [role="option"]:hover { background: var(--hover); }
  /* Background plus outline so the active option stays visible in forced-colors mode */
  & [aria-selected="true"] { background: var(--hover); outline: 2px solid var(--accent); outline-offset: -2px; }
}

/* Focus stays on the input; keep a visible focus indicator on it */
input:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
```

### 3. Filtering and keyboard behavior

```js
// Case-insensitive substring match; render only matching options.
const query = input.value.trim().toLowerCase();
const matches = options.filter(o => o.value.toLowerCase().includes(query));
```

* Typing (`input` event) re-filters, shows the popup, and resets the active option to none.
* `ArrowDown` / `ArrowUp` open the popup if closed, then move the active option and wrap at the ends. Call `preventDefault()` so the caret does not move.
* `Home` / `End` move the active option only while one is active; otherwise they keep editing the text.
* `Enter` with an active option fills the input, closes the popup, and calls `preventDefault()` so the form does not submit. With no active option, `Enter` behaves normally.
* `Escape` closes the popup when open.
* Space always types a space; never use it to select.
* Clicking an option selects it. Call `preventDefault()` on the listbox `mousedown` so the input does not blur and close the popup before the click lands.
* Close on blur.
* Do not require a match: an unlisted value stays in the input and is submitted as typed.

### 4. Announce results

Visible filtering is invisible to screen reader users unless announced. Keep a visually hidden `role="status"` (`aria-live="polite"`) element and update its text after each filter, such as "3 suggestions available" or "No suggestions". When nothing matches, show an in-popup message with `role="presentation"` rather than an option, so it is not counted as a choice.

### 5. Let users add a new item

Add this when the value is a record users build up over time (tags, destinations) and typing an unlisted value should make it a reusable choice. Skip it when unlisted values are just submitted as typed.

* When the trimmed input is non-empty and no option matches it exactly (case-insensitive), append a final `<li role="option">` labeled `Add "<typed text>"`. It is a normal option for `aria-activedescendant`, keyboard, and click handling.
* Selecting it pushes the typed value into your options source and fills the input with it, so it appears in later filters.
* With this option present, the "no suggestions" message below is only needed when the input is empty and there are no options at all.

### 6. Match highlighting

Wrap the matched substring of each option label in `<mark>`. Reset its default yellow background and use weight or underline so the match is not conveyed by color alone. Worth adding when options are long or similar.

### 7. Rich option content

Options can hold a styled title plus smaller secondary text (a description, a code, a hint). Keep the option itself as the single `role="option"` and put the content in plain inline/block children, with no nested interactive elements or extra roles. Store the value that goes into the input in a `data-value` attribute (or your options data), because the option's text content now includes the secondary text.

```html
<li role="option" id="opt-ams" data-value="Amsterdam">
  <span class="title">Amsterdam</span>
  <span class="meta">Netherlands · AMS</span>
</li>
```

```css
[role="option"] {
  display: grid;
  padding: 0.5rem 0.75rem;

  & .title { font-weight: 600; }
  & .meta { font-size: 0.8125rem; color: light-dark(#5f6368, #bdc1c6); }
}
```

* Screen readers read the whole option text, so keep secondary text short and meaningful. Do not hide it with `aria-hidden` if it helps users choose.
* Filter against both the title and the secondary text if users may search by either, and apply `<mark>` highlighting per child rather than to the whole option.
* Fill the input from `data-value` on selection, not from `textContent`.
* Group headings inside the list use `role="group"` with `aria-labelledby` pointing at a heading element; the heading is not an option.

### 8. Styling the popup

* Highlight the active option with a background plus an `outline` so it remains visible in forced-colors mode and does not rely on color alone.
* Give options enough padding for a comfortable touch target.
* Use `color-scheme: light dark` with `light-dark()` tokens so the popup matches the page theme.

## Fallback strategies

{{ FEATURE_FALLBACKS("popover") }}

{{ BASELINE_STATUS("anchor-positioning") }}

{{ BASELINE_STATUS("datalist") }}

{{ FEATURE_FALLBACKS("customizable-select") }}

**Feature detection:** Enhance only when both popover and anchor positioning are available.

```js
const enhanced = Object.hasOwn(HTMLElement.prototype, 'popover') && CSS.supports('position-anchor: --a');
```

**Experience:** This is progressive enhancement. When detection fails, leave the `list` attribute and `<datalist>` in place and skip all custom-listbox code. Users still get typing, native suggestions, and freeform values. Any external filter (for example a region `<select>`) can toggle `disabled` on the `<option>` elements to narrow the native suggestions.
