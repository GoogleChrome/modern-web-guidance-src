## Must pass
- The container holding the individual items must be configured as a CSS grid (`display: grid`).
- The individual items (cards) must also be configured as a CSS grid (`display: grid`).
- The individual items must define their row sizing using `grid-template-rows: subgrid` to inherit the row tracks from the parent container.
- The individual items must span multiple rows within the parent grid to accommodate their internal elements (e.g., spanning 3 rows for a header, body, and footer).

## Must fail
- The internal elements (e.g., headers or content areas) rely on fixed explicit heights (`height`) or minimum heights (`min-height`) to artificially align across different cards.
- The individual items use Flexbox (`display: flex`, `flex-direction: column`) combined with `flex-grow` or `margin-top: auto` to push footers down, as this fails to align intermediate elements like headers or bodies across separate items.
- JavaScript is used to calculate, synchronize, and enforce equal heights for internal elements across the row.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Do not assert specific HTML tags, class names, or IDs (e.g., `.card`, `.card-header`, `header`).
- Do not assert specific grid track sizing values (e.g., `1fr`, `minmax()`, `auto`) on the parent container, only the use of `subgrid` on the children.