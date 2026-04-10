## Must pass
- The parent container must establish a grid layout using `display: grid` and define track sizes that account for the inner card sections (e.g., defining rows for header, content, and footer).
- The individual card elements must span the necessary number of tracks within the parent grid (e.g., `grid-row: span 3`).
- The individual card elements must establish a grid context using `display: grid` and utilize the `subgrid` keyword for the relevant axis (e.g., `grid-template-rows: subgrid`).
- The corresponding internal sections of adjacent cards must visually align perfectly across the row, adapting their size dynamically to the tallest content in that specific track without overlapping.

## Must fail
- Implementing nested grids on the cards that independently define their own track sizes (e.g., `grid-template-rows: auto 1fr auto`) instead of using `subgrid`.
- Applying fixed or minimum heights (`height`, `min-height`) to the internal sections (like headers or bodies) to force horizontal alignment.
- Using JavaScript (`ResizeObserver`, `clientHeight`, etc.) to measure the tallest internal section and manually apply that height to sibling elements across different cards.
- Relying solely on Flexbox space distribution (`flex-grow: 1`, `margin-top: auto`) to align footers, which fails to accurately align intermediate sections like titles or main content blocks across varying content lengths.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.