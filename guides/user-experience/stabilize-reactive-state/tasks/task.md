---
base_app: daily-grind
---
- Add an event deadline tracker to the homepage to stabilize reactive state using the Temporal API and immutable date updates. Display the date value in `#temporal-value`, with a button `#extend-temporal-btn` that updates the date without mutating state in place, logging "Yes" in `#temporal-ref-changed` and incrementing the re-render count in `#temporal-render-count`.
