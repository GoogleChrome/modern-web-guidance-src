## Must pass
- The child container uses `display: grid` to establish a nested grid context.
- The child container uses the `subgrid` value for `grid-template-columns`, `grid-template-rows`, or both.
- Nested child elements are positioned using grid line numbers or names that correspond to the parent grid's tracks.
- The solution maintains a semantic HTML structure where nested elements remain children of their logical container.

## Must fail
- The child container defines independent grid tracks (e.g., using `1fr` or `px` units) that manually attempt to mirror the parent grid dimensions.
- The document structure is flattened, removing the nested container and making all elements direct children of the parent grid.
- The implementation uses absolute positioning or negative margins to align nested elements with the parent's grid tracks.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Do not require specific class names, IDs, or HTML tags for the grid or its items
- Focus on the functional application of the `subgrid` keyword within the CSS grid layout properties