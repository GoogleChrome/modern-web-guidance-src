---
base_app: daily-grind
---
- Add a roasting batch deadline tracker to the homepage that manages task deadlines in a reactive state view without unexpected side effects from shared mutable state. Display the deadline in `#temporal-value`, with a button `#extend-temporal-btn` that extends the deadline by 1 hour, displaying "Yes" in `#temporal-ref-changed` when the state reference changes and incrementing the re-render count in `#temporal-render-count`.
