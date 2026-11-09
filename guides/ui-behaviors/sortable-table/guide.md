---
name: sortable-table
description: Progressively enhance a data table with behaviors that allow users to sort rows by clicking on column headers.
web-feature-ids:
  - invoker-commands
  - view-transitions
  - view-transitions-element-scoped
  - move-before
guides:
  - dynamic-sort
  - responsive-table
  - icons # for the sort icon
  - move-dom-element-without-losing-state
---

# Sortable Table

Use this pattern to let users sort a data table by clicking its column headers. Start from a complete, semantic `<table>` that is readable without JavaScript, then enhance it.

This guide covers the header controls, sort state, sorting logic, and applying the new order to the DOM. For keeping state inside rows while they move, see {{ GUIDE_REF("move-dom-element-without-losing-state") }}. For other narrow-screen table patterns, see {{ GUIDE_REF("responsive-table") }}.

{# PENDING_GUIDE_REF: For sorting lists and card grids that are not tables, see {{ GUIDE_REF("dynamic-sort") }}. #}

## Header markup

* **MANDATORY:** Put a `<button type="button">` inside each sortable `<th scope="col">`. Do not make the `<th>` itself clickable, and do not use `<a>` or `role="button"`.
* Set `aria-sort="ascending"` or `aria-sort="descending"` on the `<th>` of the currently sorted column only, and remove it from all other headers. Do not set `aria-sort="none"`, and do not put `aria-sort` on the button.
* Leave non-sortable columns as plain `<th>` text with no button.
* Keep the `<caption>`, and keep rows in a `<tbody>` so header rows are never reordered.
* Use a decorative icon for the sort direction (`aria-hidden="true"`, `currentColor`, see {{ GUIDE_REF("icons") }}). Drive its appearance from `th[aria-sort]` in CSS, not from extra classes or JavaScript. Never rely on the icon alone; `aria-sort` is what assistive technology reads.
* Give the button a minimum 24px target and a `:focus-visible` outline. Make it fill the cell.

## Wire buttons with invoker commands

Use `commandfor` pointing at the table and a custom `--sort` command (custom commands must start with `--`). Handle it with one `command` listener on the table instead of a click listener per button. `event.source` is the button that was activated.

```html
<th scope="col" data-type="number">
  <button type="button" commandfor="planets" command="--sort">
    Moons
  </button>
</th>
```

```javascript
table.addEventListener('command', (event) => {
  if (event.command !== '--sort') return;

  const th = event.source.closest('th');
  const direction = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';

  for (const header of table.tHead.rows[0].cells) header.removeAttribute('aria-sort');
  th.setAttribute('aria-sort', direction);

  const rows = sortRows([...tbody.rows], th.cellIndex, th.dataset.type, direction);
  reorderWithTransition(rows);
  // One message per sort; the status element must already be in the DOM.
  status.textContent = `Sorted by ${event.source.textContent.trim()}, ${direction}, ${rows.length} rows`;
});
```

* The first activation sorts ascending; each repeat toggles direction. Switching columns starts ascending again.
* Keep focus on the header button that was activated.

## Compare values correctly

* Compare text with `Intl.Collator` (`numeric: true, sensitivity: 'base'`), not `<` or `localeCompare` in a loop.
* Compare numbers, dates and currency as numbers. Read the raw value from a `data-value` attribute (or `<time datetime>`) when the displayed text is formatted, for example `12,104` or `$1.2k`.
* Declare the type per column with `data-type` rather than guessing from content.
* `Array.prototype.sort` is stable, so equal rows keep their previous relative order.

```javascript
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function sortRows(rows, index, type, direction) {
  const factor = direction === 'ascending' ? 1 : -1;
  // Prefer the raw value when the displayed text is formatted.
  const value = (row) => row.cells[index].dataset.value ?? row.cells[index].textContent.trim();
  return rows.sort((a, b) =>
    factor * (type === 'number' ? value(a) - value(b) : collator.compare(value(a), value(b)))
  );
}
```

## Reorder the existing rows

**MANDATORY:** Move the existing `<tr>` elements within the `<tbody>`. Do not rebuild the table or `<tbody>` with `innerHTML` or a re-render: that discards focus and state inside rows and breaks view transitions, which match old and new elements by identity. Never move the header row.

```javascript
// Moving every row to the end in sorted order is enough; no need to compute minimal moves.
function reorder(container, orderedRows) {
  for (const row of orderedRows) container.moveBefore(row, null);
}
```

**DO NOT** fake the order with CSS `order`; DOM order must match visual order for keyboard and screen reader users.

## Optionally animate the reorder

Animation is an enhancement; the sort works without it. Add it when the table is small (up to a few hundred rows), since every named row is captured as an image. Skip it for larger tables.

```css
tbody tr {
  /* Derives a unique name from each row's identity. */
  view-transition-name: match-element;
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none;
  }
}
```

```javascript
// Scoped to the table so the rest of the page stays interactive during the animation.
function reorderWithTransition(rows) {
  table.startViewTransition(() => reorder(tbody, rows));
}
```

* A new transition skips the one in flight, so rapid clicks are safe as long as the callback always applies the final order.
* **DO NOT** put `aria-live` on the table: it would announce every moved row. Use the single `role="status"` element instead, hidden visually (not with `display: none`) using `clip-path: inset(50%)` and a 1px size.

## Narrow screens

Wrap the table in a horizontally scrollable container (`overflow-x: auto`) with `role="region"`, an accessible name from the caption via `aria-labelledby`, and `tabindex="0"` so keyboard users can scroll it. Give the table a `min-inline-size` so columns do not collapse.

## Fallbacks

{{ BASELINE_STATUS("invoker-commands") }}

If your Baseline target does not support invoker commands, add a `click` listener to each header button that runs the same sort function. Behavior is identical. The buttons do nothing without JavaScript either way, so add them from script if the table must stay fully readable without it.

{{ BASELINE_STATUS("view-transitions-element-scoped") }}

If your Baseline target does not support `element.startViewTransition()`, call `document.startViewTransition()`, which blocks pointer events on the whole page while it runs, so keep it brief. If that is unsupported too, call `reorder()` directly. The table still sorts and the announcement is unchanged; the animation is graceful degradation.

{{ BASELINE_STATUS("move-before") }}

If your Baseline target does not support `moveBefore()`, use `container.append(row)` in the same loop. DOM order is identical; rows lose focus, iframe or animation state inside them, which only matters when rows contain such state.

## Common mistakes

* **DO NOT** re-render the `<tbody>` or `<table>` on sort; it discards focus and state and breaks view transitions.
* **DO NOT** put `aria-live` on the table, or announce each row.
* **DO NOT** leave `aria-sort` on more than one header.
* **DO NOT** change the button's label to describe the action ("Sort ascending"). Keep the column name; `aria-sort` conveys state.
* **DO NOT** sort formatted strings when the underlying values are numbers or dates.

