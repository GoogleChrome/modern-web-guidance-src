---
name: content-table
description: Build a content table component that displays tabular data with sortable columns, filterable rows, and selectable and editable cells.
web-feature-ids:
  - sticky-positioning
  - container-scroll-state-queries
  - search
  - nesting
guides:
  - responsive-table
  - sortable-table
  - data-grid
  - scrollability-affordance-hints
---

# Content table

A content table presents read-mostly tabular data: a semantic `<table>` that stays usable as it grows. This guide is the entry point for table work. It covers sticky headers (row, column or both) and row filtering directly, and routes the rest:

* Narrow screens, stacked layouts and truncating long cell text: {{ GUIDE_REF("responsive-table") }}.
* Sortable columns (header buttons, `aria-sort`, reordering rows): {{ GUIDE_REF("sortable-table") }}.
{# PENDING_GUIDE_REF: * Selectable and editable cells, and keyboard grid navigation: {{ GUIDE_REF("data-grid") }}. #}

Start from a plain semantic table and enhance it. Sorting, filtering and sticky headers compose: filtering only toggles row visibility and sorting only reorders rows, so neither needs to know about the other.

## Markup

* **MANDATORY:** Use `<table>` with a `<caption>`, `<thead>`, `<tbody>`, `<th scope="col">` for column headers and `<th scope="row">` for the row header cell. Do not build tables from `<div>`s with ARIA roles.
* Wrap the table in a scroll container with `tabindex="0"`, `role="region"` and an accessible name (`aria-labelledby` pointing at the caption). Scrollable regions are not reliably keyboard-focusable across browsers (especially when they contain focusable controls such as sort buttons), so `tabindex="0"` is required for keyboard users to scroll the table.

Keep the caption in view when the table scrolls horizontally by making it sticky and capping it to the wrapper's width:

```css
.table-wrapper {
  container-type: inline-size;
}

caption {
  position: sticky;
  inset-inline-start: 0;
  inline-size: max-content;
  max-inline-size: 100cqi;
}
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
  overflow: auto;
  max-block-size: 70vh;
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
```

* Give sticky `<th>` cells an opaque `background` (for example a tinted `light-dark()` value), otherwise scrolled cells show through the stuck header.
* Use `border-collapse: separate` with `border-spacing: 0` on the table; with `collapse`, sticky cells lose their borders.
* **DO NOT** set `overflow` (other than `visible` or `clip`) on any element between the sticky cell and the scroll container, or the cell sticks to the wrong box.

## Stick headers to the page while columns stick to the wrapper

When the table needs horizontal scrolling in a wrapper but the column headers should stick to the page (for example under a sticky page header), the wrapper must not scroll vertically. `overflow-x: auto` alone computes `overflow-y` to `auto`, which makes the wrapper the vertical sticky reference too. Use `overflow: auto clip` so the wrapper is a scroll container on the inline axis only; `position: sticky` then tracks each axis against a different scroller.

```css
.table-wrapper {
  /* Baseline: wrapper scrolls on both axes and headers stick inside it. */
  overflow: auto;
  max-block-size: 70vh;
}

@supports named-feature(single-axis-scroll-container) {
  .table-wrapper {
    /* Scroll inline only; thead sticks to the page, row headers stick to the wrapper. */
    overflow: auto clip;
    max-block-size: none;
  }

  thead th {
    inset-block-start: var(--page-header-height, 0px);
  }
}
```

* The wrapper only scrolls inline when it is narrower than the table, and the page only scrolls vertically when the table is taller than the viewport. `clip` on the block axis cuts off content if you keep a `max-block-size`, so remove it.
* Feature-detect with `@supports named-feature(single-axis-scroll-container)` or `CSS.supports('named-feature(single-axis-scroll-container)')`. `@supports (overflow: scroll clip)` only checks parsing and is not enough.
* On the clipped axis, programmatic scrolling (`scrollTo()`) is refused, `overscroll-behavior` no longer applies, and in flex or grid the default `min-block-size: auto` takes effect and can grow the container.
* If the page has a sticky header, keep `inset-block-start` offset by its height (as in `--page-header-height` above). Set `scroll-padding-block-start` on the page scroll container (`:root`) to the page header height plus the table header row height, so a focused cell does not hide beneath either.

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

Use flow-relative values (`block-start`, `inline-start`) so the shadow follows writing direction. Avoid size-affecting changes (padding, border, font-size) in stuck-state rules, since they can change layout and flip the stuck state. Use only paint effects such as `box-shadow`, `background` and `opacity`. To hint that more columns or rows are scrollable before scrolling starts, see {{ GUIDE_REF("scrollability-affordance-hints") }}.

## Filter rows

Use a native text input and toggle the `hidden` attribute on non-matching body rows. Do not remove rows from the DOM and do not touch the header.

* **MANDATORY:** Use `<input type="search">` with a visible `<label>`, wrapped together in a `<search>` element. Filter on `input` events.
* Match case-insensitively against each row's text content; `toLocaleLowerCase()` is enough for substring filtering.
* **MANDATORY:** Announce only the no-match case, once per change, in a visually hidden `role="status"` element that already exists in the DOM, such as "No rows match your filter". Do not announce the result count when rows match, and clear the status text. Do not put `aria-live` on the table. Hide the element visually with the usual clipping pattern (`position: absolute`, 1px size, `overflow: hidden`, `clip-path: inset(50%)`), never `display: none`, which removes it from the accessibility tree.
* When no row matches, say so in the status element and show an empty-state message in an element right after `</table>` inside the wrapper (not as a `<tr>` in `<tbody>`, which would interfere with sorting); do not leave an empty table with no explanation.
* Keep the input outside the scroll container so it does not scroll away with the table.
* Optionally highlight the matched text in visible rows with the CSS Custom Highlight API (see the {{ GUIDE_REF('highlight-text-ranges') }} guide) instead of wrapping matches in `<mark>`. This leaves the DOM and the screen reader output unchanged.

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
  emptyState.hidden = visible > 0;
});
```

If rows are added or removed dynamically, iterate `tbody.rows` inside the `input` listener instead of a cached array; if the table is also sortable, re-apply nothing after sorting because `hidden` travels with each moved `<tr>`.

```css
/* Keep the empty-state message inside the visible part of a wide, horizontally scrolling table: sticky to the wrapper's inline start, capped to its width. Requires container-type: inline-size on the wrapper. */
.empty {
  position: sticky;
  inset-inline-start: 0;
  inline-size: 100cqi;
  box-sizing: border-box;
  text-align: center;
}

/* Ensure hidden rows stay hidden when a responsive stacked layout sets display on tr. */
tr[hidden] {
  display: none;
}
```

## Common mistakes

* **DO NOT** put `position: sticky` on `<thead>` when you also need sticky row headers or per-cell effects; use the `<th>` cells.
* **DO NOT** use `overflow-x: auto` alone when headers must stick to the page; `overflow-y` computes to `auto`. Use `overflow: auto clip` where supported.
* **DO NOT** leave sticky headers with a transparent background.
* **DO NOT** use `border-collapse: collapse` with sticky headers; borders scroll away.
* **DO NOT** hide filtered rows with `display: none` in CSS classes instead of `hidden`, or announce each hidden row.

## Fallbacks

{{ BASELINE_STATUS("sticky-positioning") }}

{{ BASELINE_STATUS("container-scroll-state-queries") }}

The stuck-state shadow is a progressive enhancement. Where scroll-state container queries are unsupported, the headers still stick (via `position: sticky`) and the table is fully usable; they just have no shadow. Use a plain, always-on `border-block-end` on `thead th` and `border-inline-end` on `tbody th` as the baseline look so headers are distinguishable from content either way. Do not add JavaScript to replicate the shadow.

Single-axis scroll containers are also a progressive enhancement. Where `@supports named-feature(single-axis-scroll-container)` fails, keep the baseline `overflow: auto` wrapper with a bounded `max-block-size`: both headers and columns stick inside the wrapper, which is fully usable but does not stick headers to the page. Do not add JavaScript to synchronize scrolling.
