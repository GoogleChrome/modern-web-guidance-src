---
name: nested-element-global-alignment
description: Align deeply nested elements to a global layout grid to ensure consistent positioning and facilitate full-bleed effects across complex component hierarchies.
web-feature-ids:
  - subgrid
sources:
  - https://developer.mozilla.org/docs/Web/CSS/Guides/Grid_layout/Subgrid
---

# Align Nested Elements to a Global Layout Grid with CSS Subgrid

CSS Subgrid allows deeply nested elements to participate in the track sizing and alignment of a distant ancestor grid. By inheriting the rows, columns, and gaps of a parent grid, subgrid ensures that internal components—such as card headers, form labels, or hero images—align perfectly with one another across different containers. This approach preserves semantic HTML structures and accessibility while enabling complex two-dimensional layouts that were previously impossible without structural flattening or brittle mathematical hacks.

## How to implement

### 1. Establish the parent grid
The parent container must define the master tracks that the nested elements will eventually inherit. For a "full-bleed" layout, you should define named lines to allow children to easily reference the central content area versus the full viewport width.

```css
.main-layout {
  display: grid;
  /* Define a layout with named lines for easy reference by nested subgrids */
  grid-template-columns: 
    [fullbleed-start] 1fr 
    [content-start] minmax(0, 800px) 
    [content-end] 1fr 
    [fullbleed-end];
  gap: 20px; /* This gap will be inherited by subgrids by default */
}
```

### 2. Declare the subgrid
To enable subgrid, the immediate child of the grid container must itself be a grid container. You then use the `subgrid` keyword for the columns or rows you wish to inherit.

```css
.section-wrapper {
  /* MANDATORY: The element must be a grid container to use subgrid */
  display: grid;
  
  /* Span the entire width of the parent to make all tracks available to children */
  grid-column: fullbleed;
  
  /* Inherit the parent's column definitions and named lines */
  grid-template-columns: subgrid;
  
  /* Rows remain independent unless also set to subgrid */
  grid-template-rows: auto;
}
```

### 3. Align nested children to the global grid
Once a wrapper is defined as a subgrid, its children can reference the parent's tracks. Note that while named lines like `content-start` are inherited, numerical line indices restart at `1` for the subgrid itself.

```css
.nested-content {
  /* Align this deeply nested element to the 'content' tracks defined two levels up */
  grid-column: content; 
}

.nested-full-bleed-image {
  /* This image can break out to the full viewport width using the inherited named lines */
  grid-column: fullbleed;
  width: 100%;
  object-fit: cover;
}
```

### 4. Harmonize internal component heights
Subgrid is highly effective for aligning internal elements of sibling cards (like titles or footers) so they share the same height across a row.

```css
.card-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  /* Define rows for Header, Body, and Footer */
  grid-template-rows: auto 1fr auto;
}

.card {
  display: grid;
  /* MANDATORY: Span the number of rows you want to inherit (3 in this case) */
  grid-row: span 3;
  grid-template-rows: subgrid;
}

.card-header {
  /* Every card header in the row will now have the same height as the tallest one */
  grid-row: 1;
}
```

### 5. Manage gaps and constraints
By default, subgrids inherit the `gap` of the parent. You can override this locally, but the tracks will remain aligned to the parent's geometry.

```css
.subgrid-custom-gap {
  display: grid;
  grid-template-columns: subgrid;
  /* Overriding the gap to 0 makes the cells touch, but their centers stay aligned to the parent tracks */
  gap: 0;
}

/* 
   TECHNICAL CAVEAT: Subgrids do not support implicit tracks. 
   If you have 5 items but the subgrid only spans 4 columns, 
   the 5th item will overflow and stack in the last available track.
*/
```

## Fallback strategies

{{ BASELINE_STATUS("subgrid") }}

If a browser does not support subgrid, nested elements will default to a standard flow layout or an independent grid, which usually results in loss of alignment between sibling components.

### 1. Feature detection
Use `@supports` to provide a baseline experience for older browsers. Usually, the best fallback is a standard nested grid with `1fr` columns, accepting that heights or widths might not perfectly sync with siblings.

```css
/* Baseline nested grid */
.card {
  display: grid;
  grid-template-rows: auto 1fr auto;
}

/* Enhanced subgrid experience */
@supports (grid-template-rows: subgrid) {
  .card-container {
    grid-template-rows: auto 1fr auto;
  }
  .card {
    grid-row: span 3;
    grid-template-rows: subgrid;
  }
}
```

### 2. Using `display: contents` (Progressive Enhancement)
For simple alignment where you don't need to style the wrapper itself (backgrounds, borders, or padding), `display: contents` can act as a fallback by making the children behave as direct children of the master grid.

*   **DO NOT** use `display: contents` if the wrapper needs a border or background, as the box is removed from the layout.
*   **WARNING**: `display: contents` has historically caused accessibility issues where elements are removed from the accessibility tree. Test thoroughly with screen readers.

### 3. CSS Variables for Manual Sync
For critical alignments in non-subgrid browsers, use CSS variables to manually sync widths or heights, though this requires knowing the dimensions in advance.

```css
:root {
  --sidebar-width: 200px; /* Shared constant to simulate alignment */
}

.sidebar { width: var(--sidebar-width); }
.nested-sidebar-element { width: var(--sidebar-width); }