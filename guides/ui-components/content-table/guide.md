---
name: content-table
description: Build a content table component that displays tabular data with sortable columns, filterable rows, and selectable and editable cells.
web-feature-ids:
  - sticky-positioning
  - container-scroll-state-queries
guides:
  - responsive-table
  - sortable-table
  - data-grid
---

# Content table

A content table presents read-mostly tabular data: a semantic `<table>` that stays usable as it grows. This guide is the entry point for table work. It covers sticky headers (row, column or both) and row filtering directly, and routes the rest:

* Narrow screens, stacked layouts and truncating long cell text: {{ GUIDE_REF("responsive-table") }}.
* Sortable columns (header buttons, `aria-sort`, reordering rows): {{ GUIDE_REF("sortable-table") }}.
{# PENDING_GUIDE_REF: * Selectable and editable cells, and keyboard grid navigation: {{ GUIDE_REF("data-grid") }}. #}

Start from a plain semantic table and enhance it. Sorting, filtering and sticky headers compose: filtering only toggles row visibility and sorting only reorders rows, so neither needs to know about the other.

## Markup

* **MANDATORY:** Use `<table>` with a `<caption>`, `<thead>`, `<tbody>`, `<th scope="col">` for column headers and `<th scope="row">` for the row header cell. Do not build tables from `<div>`s with ARIA roles.
* Wrap the table in a scroll container with `tabindex="0"`, `role="region"` and an accessible name (`aria-labelledby` pointing at the caption). Keyboard users can then scroll it.

```html
<div class="table-wrapper" role="region" aria-labelledby="people-caption" tabindex="0">
  <table>
    <caption id="people-caption">Team directory</caption>
    <thead>
      <tr>
        <th scope="col">Name</th>
        <th scope="col">Role</th>
        <th scope="col">Location</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">Alex Rivera</th>
        <td>Engineer</td>
        <td>Lisbon</td>
      </tr>
    </tbody>
  </table>
</div>
```

## Sticky headers

Use `position: sticky` on the `<th>` cells themselves (not on `<thead>`/`<tr>`), inside a scroll container whose size is bounded. Choose by table shape:

| Table | Make sticky |
|---|---|
| Many rows | Column headers (`thead th`) |
| Many columns | Row headers (`tbody th`) |
| Both | Both, plus the corner cell (`thead th:first-child`) sticky on both axes |

```css
.table-wrapper {
  /* Sticky is relative to the nearest scrolling ancestor, so the wrapper must scroll in the sticky axis.
     Bound the block size (value is an example) or it never scrolls vertically. */
  --table-head-bg: light-dark(#f1f3f6, #262b32);
  overflow: auto;
  max-block-size: 70vh;
}

table {
  /* Sticky cells lose their borders with collapse; use separate. */
  border-collapse: separate;
  border-spacing: 0;

  th {
    /* Opaque background: otherwise scrolled cells show through the stuck header. */
    background: var(--table-head-bg);
  }

  thead th {
    position: sticky;
    inset-block-start: 0;
    z-index: 1;

    /* Corner: sticky on both axes and above both header types. */
    &:first-child {
      inset-inline-start: 0;
      z-index: 2;
    }
  }

  tbody th {
    position: sticky;
    inset-inline-start: 0;
  }
}
```

* **DO NOT** set `overflow` (other than `visible`) on any element between the sticky cell and the scroll container, or the cell sticks to the wrong box.
* If the page has its own sticky header, offset `inset-block-start` by its height and set `scroll-padding-block-start` on the scroll container so focused cells are not hidden beneath the sticky header.

## Show when headers are stuck

Optionally add a shadow or border only while a header is stuck, so users can tell content is scrolled beneath it. Set `container-type: scroll-state` on the sticky element itself and style it through `::after` (a container's own pseudo-elements, or its descendants, can be queried; the element itself cannot).

```css
thead th,
tbody th {
  container-type: scroll-state;
  /* Name containers; unnamed scroll-state containers collide when nested. */
  container-name: sticky-header;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    transition: box-shadow 0.2s;
  }
}

@container sticky-header scroll-state(stuck: block-start) {
  thead th::after { box-shadow: 0 2px 4px -2px rgb(0 0 0 / 0.5); }
}

@container sticky-header scroll-state(stuck: inline-start) {
  tbody th::after { box-shadow: 2px 0 4px -2px rgb(0 0 0 / 0.5); }
}

/* Shadows are removed in forced-colors mode; keep a visible boundary. */
@media (forced-colors: active) {
  thead th,
  tbody th { border: 1px solid CanvasText; }
}
```

Use flow-relative values (`block-start`, `inline-start`) so the shadow follows writing direction. Do not change the stuck cell's size when stuck (it can oscillate), only paint effects such as shadows.

## Filter rows

Use a native text input and toggle the `hidden` attribute on non-matching body rows. Do not remove rows from the DOM and do not touch the header.

* **MANDATORY:** Use `<input type="search">` with a visible `<label>`. Filter on `input` events.
* Match case-insensitively against each row's text content; `toLocaleLowerCase()` is enough for substring filtering.
* **MANDATORY:** Announce only the no-match case, once per change, in a visually hidden `role="status"` element that already exists in the DOM, such as "No rows match your filter". Do not announce the result count when rows match, and clear the status text. Do not put `aria-live` on the table.
* When no row matches, say so in the status element and show an empty-state message; do not leave an empty `<tbody>` with no explanation.
* Keep the input outside the scroll container so it does not scroll away with the table.
* Optionally highlight the matched text in visible rows with the CSS Custom Highlight API (see the `highlight-text-ranges` guide) instead of wrapping matches in `<mark>`. This leaves the DOM and the screen reader output unchanged.

```html
<label for="filter">Filter team</label>
<input id="filter" type="search" aria-controls="people-table">
<p id="filter-status" role="status" class="visually-hidden"></p>
```

```javascript
const rows = [...tbody.rows];

filter.addEventListener('input', () => {
  const query = filter.value.trim().toLocaleLowerCase();
  let visible = 0;
  for (const row of rows) {
    const match = row.textContent.toLocaleLowerCase().includes(query);
    row.hidden = !match;
    if (match) visible++;
  }
  // Announce only when nothing matches; stay silent otherwise.
  status.textContent = visible ? '' : 'No rows match your filter';
});
```

If the table is also sortable, read rows from `tbody.rows` at filter time instead of a cached array so reordered rows keep their `hidden` state, and re-apply nothing after sorting: `hidden` travels with each row.

```css
/* Hides text visually but keeps it available to screen readers. Do not use display: none. */
.visually-hidden {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```

## Common mistakes

* **DO NOT** put `position: sticky` on `<thead>` when you also need sticky row headers or per-cell effects; use the `<th>` cells.
* **DO NOT** leave sticky headers with a transparent background.
* **DO NOT** use `border-collapse: collapse` with sticky headers; borders scroll away.
* **DO NOT** hide filtered rows with `display: none` in CSS classes instead of `hidden`, or announce each hidden row.

## Fallbacks

{{ BASELINE_STATUS("sticky-positioning") }}

{{ BASELINE_STATUS("container-scroll-state-queries") }}

The stuck-state shadow is a progressive enhancement. Where scroll-state container queries are unsupported, the headers still stick (via `position: sticky`) and the table is fully usable; they just have no shadow. Use a plain, always-on `border-block-end` on `thead th` and `border-inline-end` on `tbody th` as the baseline look so headers are distinguishable from content either way. Do not add JavaScript to replicate the shadow.
