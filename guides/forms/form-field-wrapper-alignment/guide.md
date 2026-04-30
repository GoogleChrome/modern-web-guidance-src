---
name: form-field-wrapper-alignment
description: Align labels and input fields into a uniform multi-column layout when each pair is wrapped in its own semantic container.
web-feature-ids:
  - subgrid
sources:
  - https://developer.mozilla.org/docs/Web/CSS/Guides/Grid_layout/Subgrid
---

# Align labels and inputs across semantic containers with CSS Subgrid

Standard CSS Grid only coordinates the layout of direct children. When form elements are wrapped in semantic containers for accessibility or styling (such as `<li>` or `<div>` "field rows"), those internal elements lose the ability to align with their siblings in other rows. CSS Subgrid solves this by allowing nested elements to participate in the tracks of a parent grid. This ensures all labels share the same width based on the largest label in the entire form, while maintaining a clean, accessible HTML structure.

## How to implement

### Establish the parent grid
The parent element (e.g., `<form>` or `<ul>`) defines the column tracks that all nested rows will share.

```css
.form-parent {
  display: grid;
  /* Track 1: Labels (sized to fit the longest text) */
  /* Track 2: Inputs (fills the remaining space) */
  grid-template-columns: max-content 1fr;
  /* Subgrids inherit this gap by default, ensuring uniform spacing */
  gap: 1.5rem; 
}
```

### Configure the subgrid wrapper
The element wrapping each label and input pair must be told to adopt the parent's grid tracks.

```css
.field-row {
  /* MANDATORY: You must declare display: grid to establish a grid context */
  display: grid;
  
  /* MANDATORY: The subgrid must span the parent tracks it needs to use */
  grid-column: span 2; 
  
  /* Inherit the 'max-content 1fr' tracks from .form-parent */
  grid-template-columns: subgrid;
}
```

### Position the nested elements
Because the `.field-row` is now a subgrid, its children (the label and input) are placed directly into the tracks defined by the `.form-parent`.

```css
.field-row label {
  /* Occupies the first column (the 'max-content' track) */
  grid-column: 1;
}

.field-row input {
  /* Occupies the second column (the '1fr' track) */
  grid-column: 2;
  /* Ensure the input fills the available 1fr space */
  width: 100%; 
}
```

### Technical constraints and behavior
*   **No Implicit Tracks**: Subgrids cannot generate their own implicit tracks. If you have three items in a `grid-column: span 2` subgrid, the third item will overlap the second in the last available track.
*   **Track Clamping**: Items inside a subgrid are strictly clamped to the subgrid's span. If a child is instructed to span 3 columns but the subgrid only spans 2, the browser will force the child to fit within those 2 columns.
*   **Gap Customization**: While subgrids inherit the parent `gap` by default, you can override it using the `gap` property on the subgrid element itself.

## Fallback strategies
{{ BASELINE_STATUS("subgrid") }}

When `subgrid` is not supported, the `grid-template-columns: subgrid` declaration is ignored. The wrapper will behave like a standard block element or a 1-column grid, causing labels and inputs to lose their horizontal alignment across rows.

### Progressive Enhancement
Provide a usable stacked or flex-based layout for older browsers, then upgrade to Subgrid for browsers that support it.

```css
.field-row {
  /* Fallback: Stacked layout for older browsers */
  display: flex;
  flex-direction: column;
  margin-bottom: 1rem;
}

/* Check for subgrid support specifically on the columns axis */
@supports (grid-template-columns: subgrid) {
  .field-row {
    display: grid;
    grid-column: span 2;
    grid-template-columns: subgrid;
    margin-bottom: 0;
  }
}
```

### Avoiding display: contents
Avoid using `display: contents` as a fallback. While it can visually "flatten" the DOM to achieve alignment, it has a history of severe accessibility bugs where the element and its semantic role are stripped from the accessibility tree, rendering the container and its label relationship broken for screen reader users. Subgrid is the superior approach because it preserves the element's box and semantic integrity.