## Must pass
- The card component applies `grid-template-rows: subgrid` or `grid-template-columns: subgrid` to align its internal elements with the parent grid tracks.
- Internal sections (e.g., headers, descriptions, footers) of adjacent cards stay synchronized in height and position regardless of content variance.
- The parent grid container defines multiple tracks that are explicitly consumed by the child card components.

## Must fail
- The implementation relies on JavaScript or `ResizeObserver` to calculate and apply uniform heights to elements across different cards.
- Card components use `min-height` or fixed `height` values on internal sections to force visual alignment.
- Each card component defines its own independent internal grid tracks rather than inheriting them from the parent grid.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Focus on the implementation of CSS Grid Level 2 Subgrid capabilities
- The layout must remain purely declarative without imperative styling logic or manual height calculations