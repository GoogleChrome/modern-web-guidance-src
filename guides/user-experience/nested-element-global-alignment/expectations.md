## Must pass
- Deeply nested elements utilize the parent's grid tracks by applying `subgrid` to `grid-template-columns` or `grid-template-rows`.
- Elements within a subgrid align precisely with the parent grid lines regardless of the nesting level of their container.
- Changes to the parent grid track definitions automatically update the positioning of items within the subgrid without requiring manual adjustments to the nested component.
- Intrinsic sizing (e.g., `min-content`, `max-content`) of items within a subgrid contributes to the sizing of the parent's grid tracks.

## Must fail
- Redundant, manually duplicated `grid-template` definitions on nested components to mimic parent grid alignment.
- Usage of negative margins, fixed offsets, or absolute positioning to force alignment of nested items with a global grid.
- Reliance on `display: contents` on wrapper elements as the sole mechanism for alignment when those wrappers require their own visual styling (e.g., borders, backgrounds, or padding).

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.