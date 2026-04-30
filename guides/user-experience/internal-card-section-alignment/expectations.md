## Must pass
- The parent container establishes a grid with specific row tracks intended for card sub-sections (e.g., header, content, footer).
- Card components use `grid-template-rows: subgrid` to inherit the row track sizing from the parent grid.
- Internal elements of sibling cards (like headers) are assigned to the same grid row index or name.
- The computed height of internal sections (headers, footers) is identical across all cards in a row, even when content volume varies between them.

## Must fail
- Use of fixed `height` or `min-height` values on internal sections to simulate alignment.
- Use of JavaScript-based ResizeObservers or height-matching scripts to synchronize dimensions.
- Reliance on standard nested Flexbox or Grid without `subgrid`, which results in internal sections having independent heights based on their own content.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.