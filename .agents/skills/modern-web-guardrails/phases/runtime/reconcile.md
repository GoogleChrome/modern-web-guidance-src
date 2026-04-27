# Command: reconcile

Maps static configuration baselines against runtime violations to identify coverage discrepancies.

## Purpose
Compares findings from discovery against Lighthouse JSON reports.

## Discrepancy Categories
- **R1**: Runtime violation not caught by lint (coverage gap). No matching allow-list entries exist.
- **R2**: Runtime violation permitted by allow-list.
- **R3**: Static lint flags a feature as unavailable, but runtime shows it as `low` (Newly Available).
- **R4**: Runtime deprecations flagged without static rules.

## R3 Tiebreaker: webstatus.dev

When static lint data and Lighthouse runtime data disagree on whether a feature is newly available (R3), use **[webstatus.dev](https://webstatus.dev)** as the authoritative tiebreaker:

- Look up the feature at `https://webstatus.dev/features/<feature-id>`
- If webstatus.dev confirms `Newly Available`, Lighthouse wins — add the property to `allowProperties` (or equivalent allow-list) so the stale lint data stops producing false positives.
- If webstatus.dev shows `Limited Availability`, ESLint wins — the runtime data may be ahead of stable and the lint restriction should stand.
- Always include the webstatus.dev URL in the conflict resolution notes for traceability.
