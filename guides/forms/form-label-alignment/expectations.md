## Must pass
- The outer container defines a grid layout with specific column tracks.
- Child elements representing rows or field groups use `grid-template-columns: subgrid` to inherit the parent's track definitions.
- Labels and input fields in different row containers align to the same vertical lines across the entire form.
- The shared column widths adjust dynamically based on the largest content within any subgrid-enabled row.

## Must fail
- Using fixed or hardcoded widths on label elements to force alignment.
- Using `display: flex` on row containers, which prevents true column alignment across multiple rows.
- Defining duplicate `grid-template-columns` values on every row instead of inheriting from the parent grid.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Focus on the application of CSS Grid properties and the inheritance of tracks
- Assert that alignment is achieved through the grid system rather than manual spacing or sizing measurements