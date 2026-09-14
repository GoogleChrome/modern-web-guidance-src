---
name: responsive-table
description: Build a data table that presents tabular data with proper header semantics, and remains readable and navigable on small screens and with assistive technologies.
web-feature-ids:
  - sticky-positioning
  - container-queries
---

Large data tables often become unreadable on small screens as columns overflow or shrink beyond legibility. This guide demonstrates how to use **sticky positioning** to keep headers visible during scrolling and how to transform the table into a mobile-friendly "stacked" layout when space is limited.

## Recommended Approach

The core of a responsive table is maintaining the relationship between data cells and their headers.

1.  **Semantic Foundation**: Use standard `<table>` elements with `<thead>`, `<tbody>`, and `<th>` elements. Use `scope="col"` and `scope="row"` to ensure assistive technologies can map data correctly.
2.  **Sticky Context**: Apply `position: sticky` to both column headers and row headers. This ensures that no matter how far a user scrolls in any direction, they never lose the context of what the data represents.
3.  **Adaptive Transformations**: Use `@container` queries instead of `@media` queries. This allows the table to adapt based on its own width (e.g., when placed in a sidebar or a narrow dashboard widget) rather than the entire viewport.
4.  **Label Injection**: In the stacked layout, the `<thead>` is visually hidden, and headers are injected into each cell using `::before` pseudo-elements and `data-` attributes.

## Implementation Steps

### 1. Markup with Data Labels
Structure your table with clear semantic headers. Add a `data-label` attribute to each `<td>` that matches its corresponding column header. Wrap in a `.table-wrapper` element to provide a container for sizing and overflow.

```html
<div class="table-wrapper">
  <table>
    <thead>
      <tr>
        <th scope="col">Employee</th>
        <th scope="col">Role</th>
        <th scope="col">Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <!-- Row header remains sticky horizontally -->
        <th scope="row">Alex Rivera</th>
        <td data-label="Role">Engineer</td>
        <td data-label="Status">Active</td>
      </tr>
    </tbody>
  </table>
</div>
```

### 2. Configure Sticky Headers
Enable horizontal and vertical scrolling on the wrapper, and make the headers sticky. Assign the headers higher `z-index` vlaues, with the column headers above the row headers.

```css
.table-wrapper {
  overflow: auto;
  max-inline-size: 100%;
  max-block-size: min(500px, 80vh); /* Example value: adjust based on layout needs */
  container-type: inline-size;
}

table {
  border-collapse: separate; /*  Prevent sticky-related spacing visual issues. */
  border-spacing: 0;

}

/* Sticky column headers */
thead th {
  position: sticky;
  inset-block-start: 0;
  z-index: 10; /* Put sticky column headers above sticky row headers. */
  background: #eee; /* Example color */
}

/* Sticky row headers (first column) */
th[scope="row"] {
  position: sticky;
  inset-inline-start: 0;
  background: #f9f9f9; /* Example color */
  z-index: 5;
}
```

### 3. Responsive Stacked Layout
When the container is narrow, switch to a block-based layout. Use `::before` to display the `data-label`. 

MANDATORY: The `content` value must have empty alternative text set. Otherwise, screen readers will announce the column header twice.

```css
content: attr(data-label) ": " / "";
```

```css
@container (width < 600px) { /* Example threshold: adjust based on table content */
  /* Reset table display for stacking */
  table, thead, tbody, tr, th, td {
    display: block;
  }

  thead {
    /* MANDATORY: Visually hidden but accessible to screen readers */
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  tr {
    margin-block-end: 1.5rem; /* Example spacing */
    border: 1px solid #ccc;
  }

  th[scope="row"] {
    /* Sticky card header */
    position: sticky;
    inset-block-start: 0;
    background: #f0f0f0; /* Example color */
    font-weight: bold;
    padding: 0.5rem;
  }

  td {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem;
    border-block-end: 1px solid #eee;
  }

  /* Inject column labels */
  td::before {
    /* MANDATORY: Must have empty alternative text to avoid screen readers announcing the header multiple times. */
    content: attr(data-label) ": " / ""; 
    font-weight: bold;
    color: #666; /* Example color */
  }
}
```

## Fallbacks

### Container Queries
{{ FEATURE_FALLBACKS("container-queries") }}

If your target environment does not support container queries, use `@media` queries to provide a viewport-based fallback.

```css
/* Optional viewport-based fallback */
@media (max-width: 600px) {
  @supports not (container-type: inline-size) {
    /* Repeat stacked layout styles here */
  }
}
```
