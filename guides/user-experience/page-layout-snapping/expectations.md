## Must pass
- The main layout container must use `display: grid` with defined grid columns or rows.
- The nested child container must use `grid-template-columns: subgrid` or `grid-template-rows: subgrid` to align its items with the parent grid.
- The HTML structure must preserve its logical, nested component hierarchy without being artificially flattened.

## Must fail
- The nested component manually redefines the identical grid tracks of its parent container instead of using `subgrid`.
- Alignment of nested children is faked using hardcoded widths, exact percentages, or synchronized margins/padding.
- The DOM hierarchy is flattened by removing semantic wrapper elements to force items to be direct children of the parent grid.
- `display: contents` is used as a workaround to achieve alignment, stripping the container's box from the layout tree.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Do not assert specific CSS class names, IDs, element tags, or component names.
- Do not assert exact grid track sizes, gaps, or the specific number of columns/rows defined.