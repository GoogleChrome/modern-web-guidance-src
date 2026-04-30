## Must pass
- The parent container defines a multi-column grid layout.
- Semantic wrappers for each label-input pair use `grid-template-columns: subgrid` to adopt the parent's track definitions.
- All label elements across different wrappers occupy the same logical grid column.
- All input elements across different wrappers occupy the same logical grid column.
- Column widths remain uniform across all wrappers, even when content (like a long label) in one wrapper would otherwise cause a local layout shift.

## Must fail
- Using fixed pixel or percentage widths on labels to simulate alignment across separate containers.
- Using nested grid or flexbox layouts on wrappers that do not utilize `subgrid`, resulting in misaligned columns when content sizes vary.
- Relying on `display: table` or actual `<table>` elements to achieve horizontal alignment of fields across semantic boundaries.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.