---
name: internal-card-section-alignment
description: Align internal sections of sibling card components, such as headers and footers, to ensure they have matching heights across a row regardless of content variability.
web-feature-ids:
  - subgrid
sources:
  - https://developer.mozilla.org/docs/Web/CSS/Guides/Grid_layout/Subgrid
---

# Aligning Nested Card Sections with CSS Subgrid

When displaying a row of card components, varying content lengths—such as titles of different lengths or descriptions with varying word counts—often lead to misaligned internal sections. Traditional CSS Grid aligns the card containers themselves, but the headers, bodies, and footers inside those cards remain isolated and do not "know" about the heights of their siblings. CSS Subgrid solves this by allowing nested elements to participate directly in the parent grid's tracks. This ensures that internal sections stay perfectly synchronized across all sibling cards in a row, with the tallest element in any card determining the height for that corresponding section in every other card.

## How to implement

### Define the shared rows on the parent container
The parent container must establish the grid tracks that all nested card sections will occupy. Use `grid-template-rows` to define the heights for each section of the card (e.g., header, main content, and footer).

```css
.card-container {
  display: grid;
  /* Create a responsive grid of cards */
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  
  /* Define three rows for the card internals: header (auto), body (1fr), and footer (auto) */
  /* The 1fr track will expand to fill space and align the footers to the bottom across the row */
  grid-template-rows: auto 1fr auto;
  
  /* Rhythmic spacing between individual cards */
  gap: 2rem; 
}
```

### Configure the card as a subgrid
Each card must be a direct child of the grid container. It needs to span the exact number of rows defined for the internal sections and then adopt those rows using the `subgrid` keyword.

```css
.card {
  /* MANDATORY: Every subgrid must also be a grid container */
  display: grid;
  
  /* MANDATORY: The card must span the number of parent rows it intends to inherit. */
  /* Subgrids cannot create implicit tracks; if you span 3 rows, you are limited to 3 rows. */
  grid-row: span 3;
  
  /* Inherit the row definitions from the parent container */
  grid-template-rows: subgrid;
  
  /* Subgrids automatically inherit the parent's gaps. Override them here if internal spacing should differ. */
  /* row-gap: 0; Example: remove space between header/body/footer while maintaining alignment */
  
  border: 1px solid #ddd;
  padding: 1rem;
}
```

### Structure internal elements
Because the card is a subgrid, its direct children will automatically align to the rows defined in the `.card-container`. While they flow into the rows naturally based on DOM order, you can also use explicit placement for clarity.

```css
.card-header {
  /* Explicitly placing in the first inherited row (auto) */
  grid-row: 1;
  font-weight: bold;
}

.card-body {
  /* Explicitly placing in the second (flexible 1fr) inherited row */
  grid-row: 2;
}

.card-footer {
  /* Explicitly placing in the third inherited row (auto) */
  grid-row: 3;
  margin-top: auto; /* Optional: ensures content pushes up if the row is tall */
}
```

## Fallback strategies

{{ BASELINE_STATUS("subgrid") }}

### Graceful degradation with independent grids
In browsers without subgrid support, the `grid-template-rows: subgrid` declaration is ignored. You should provide a fallback layout where each card manages its own internal alignment using standard grid or flexbox. This ensures the UI remains functional and readable, even if internal sections across different cards do not align perfectly.

```css
.card {
  display: grid;
  /* Fallback: internal rows for browsers without subgrid support */
  grid-template-rows: auto 1fr auto;
}

/* Enhancement: override for browsers that support subgrid */
@supports (grid-template-rows: subgrid) {
  .card {
    grid-template-rows: subgrid;
    grid-row: span 3;
  }
}
```

### Avoid `display: contents` for layout
While `display: contents` can be used to flatten a hierarchy and achieve alignment by making the card's children direct children of the parent grid, it is generally discouraged for this use case. `display: contents` can strip the card element of its semantic meaning and remove it from the accessibility tree, meaning screen readers may no longer identify the element as a distinct article or list item.

### Using flexbox for internal distribution
If subgrid is unavailable, you can use `display: flex` with `flex-direction: column` on the card to ensure the footer is pushed to the bottom. This provides internal consistency within each card even when cross-card alignment is not possible.

```css
.card {
  display: flex;
  flex-direction: column;
}

.card-body {
  /* Push the footer to the bottom of the individual card */
  flex: 1;
}