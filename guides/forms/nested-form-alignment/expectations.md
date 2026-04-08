## Must pass
- The parent container's layout must be defined using CSS Grid (`display: grid`)
- Nested containers (e.g., fieldsets, form groups, or component wrappers) must use `grid-template-columns: subgrid` or `grid-template-rows: subgrid` to adopt the parent grid's tracks
- Labels and inputs inside these nested containers must align seamlessly along the tracks defined by the top-level parent grid

## Must fail
- Relying on hardcoded fixed widths, percentages, or magic numbers (e.g., `width: 150px` or `width: 30%`) on labels or columns to manually force alignment
- Using `display: contents` on nested wrappers solely as a hack to flatten the DOM for grid participation, which removes the wrapper's ability to have its own styling (like borders or backgrounds) or impacts accessibility
- Synchronizing column widths across nested components using JavaScript layout calculations or resize listeners

## App-agnostic rules
- Do not assert specific variable names, function names, class names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Do not assert specific HTML tags or exact DOM nesting depths, beyond the presence of a parent grid and a nested subgrid
- Do not mandate a specific CSS authoring tool or framework (e.g., Tailwind, Styled Components, CSS Modules), provided the compiled output relies on standard CSS `subgrid` properties