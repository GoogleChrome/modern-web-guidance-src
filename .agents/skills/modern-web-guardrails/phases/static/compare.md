# Command: compare

Cross-references and matches baseline settings to detect Type 1–5 conflicts.

## Purpose
To find instances where different tools enforce differing browser tiers for overlapping file scopes.

## Conflict Types
- **Type 1**: Cross-tool conflict (e.g. ESLint vs Stylelint disagree on baseline level for `.css`).
- **Type 2**: Cross-scope conflict within ESLint (e.g. `.html` uses "newly" while `.js` uses "widely").
- **Type 3**: Browserslist vs explicit rule conflict.
- **Type 4**: Custom config vs lint rule conflict.
- **Type 5**: Inline exception scope creep (file-level suppression over extensive line blocks).

## Evaluation Logic
When comparing queries to explicit available tiers ("widely", "newly"), use these criteria:
- Broad evergreen targets (e.g. `> 1%`) ≈ `widely`
- Precise full coverage ≈ `newly`
- Explicit year versions (e.g., `2023`) = year-pinned
